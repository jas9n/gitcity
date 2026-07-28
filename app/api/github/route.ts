import { NextRequest, NextResponse } from "next/server";
import type { RepositorySignal } from "@/lib/city-model";
import { isCachedExploreTarget } from "@/lib/discovery";
import {
  readGithubCache,
  writeGithubCache,
} from "@/lib/github-cache";

export const runtime = "nodejs";
export const maxDuration = 60;

const GITHUB_API = "https://api.github.com";
const OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const REPOSITORY_PATTERN =
  /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[a-z\d._-]{1,100}$/i;
const PAGE_SIZE = 100;
const EXPLORE_CACHE_TTL = 24 * 60 * 60 * 1000;
const GITHUB_TIMEOUT_MS = 12_000;
const GITHUB_FETCH_ATTEMPTS = 2;

type OwnerType = "organization" | "user";

type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  created_at: string;
  pushed_at: string;
  archived: boolean;
  fork: boolean;
};

type GitHubOwner = {
  login: string;
  type: "Organization" | "User";
  avatar_url: string;
  public_repos: number;
};

type GitHubPagePayload = {
  owner: string;
  ownerType: OwnerType;
  ownerAvatarUrl: string | null;
  repositories: RepositorySignal[];
  page: number;
  perPage: number;
  hasMore: boolean;
  totalRepositories: number | null;
  view: "popular" | "recent";
  focusedRepository: string | null;
  collectedAt: string;
  cache: "durable" | "edge";
};

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "git-city-visualizer",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchGitHub(path: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < GITHUB_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${GITHUB_API}${path}`, {
        headers: githubHeaders(),
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });

      if (response.status < 500 || attempt === GITHUB_FETCH_ATTEMPTS - 1) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === GITHUB_FETCH_ATTEMPTS - 1) throw error;
    }
  }

  throw lastError ?? new Error("GitHub request failed without a response.");
}

function countFromPaginatedResponse(response: Response, itemCount: number) {
  const link = response.headers.get("link") ?? "";
  const lastPage = link.match(/[?&]page=(\d+)>;\s*rel="last"/)?.[1];
  return lastPage ? Number(lastPage) : itemCount;
}

function hasNextPage(response: Response, itemCount: number) {
  return (
    /rel="next"/.test(response.headers.get("link") ?? "") ||
    itemCount === PAGE_SIZE
  );
}

function githubError(status: number) {
  return status === 403 || status === 429
    ? "GitHub’s request limit is busy. Cached Explore cities and the demo are still available."
    : "That GitHub owner could not be loaded.";
}

function ownerTypeFromIdentity(identity: GitHubOwner): OwnerType {
  return identity.type === "Organization" ? "organization" : "user";
}

function estimateMetrics(repo: GitHubRepository) {
  const daysSincePush = Math.max(
    0,
    (Date.now() - new Date(repo.pushed_at).getTime()) / 86_400_000,
  );
  const recency = Math.max(0, 1 - daysSincePush / 180);
  const commits30d = repo.archived
    ? 0
    : Math.round(
        recency *
          (3 +
            Math.log1p(repo.stargazers_count) * 2.8 +
            Math.min(repo.open_issues_count, 35)),
      );
  const contributorCount = Math.max(
    1,
    Math.round(Math.log10(repo.stargazers_count + 10) * 8),
  );
  return { commits30d, contributorCount };
}

function normalizeRepository(
  repo: GitHubRepository,
  metrics?: { commits30d: number; contributorCount: number },
): RepositorySignal {
  const signal = metrics ?? estimateMetrics(repo);
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? "No repository description provided.",
    url: repo.html_url,
    language: repo.language ?? "Other",
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    sizeKb: repo.size,
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    archived: repo.archived,
    isFork: repo.fork,
    commits30d: signal.commits30d,
    mergedPullRequests30d: 0,
    closedIssues30d: 0,
    openedIssues30d: 0,
    contributorCount: signal.contributorCount,
    metricsEstimated: metrics === undefined,
  };
}

async function collectRepoMetrics(repo: GitHubRepository) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [repositoryOwner, repositoryName] = repo.full_name.split("/");
  const base = `/repos/${encodeURIComponent(repositoryOwner)}/${encodeURIComponent(repositoryName)}`;
  const [commitsResponse, contributorsResponse] = await Promise.all([
    fetchGitHub(`${base}/commits?since=${encodeURIComponent(since)}&per_page=1`),
    fetchGitHub(`${base}/contributors?anon=1&per_page=1`),
  ]);
  const commits = commitsResponse.ok
    ? ((await commitsResponse.json()) as unknown[])
    : [];
  const contributors = contributorsResponse.ok
    ? ((await contributorsResponse.json()) as unknown[])
    : [];

  return {
    commits30d: commitsResponse.ok
      ? countFromPaginatedResponse(commitsResponse, commits.length)
      : estimateMetrics(repo).commits30d,
    contributorCount: contributorsResponse.ok
      ? countFromPaginatedResponse(contributorsResponse, contributors.length)
      : estimateMetrics(repo).contributorCount,
  };
}

function cacheKey({
  owner,
  page,
  view,
  repository,
  detail,
}: {
  owner: string;
  page: number;
  view: string;
  repository: string;
  detail: boolean;
}) {
  if (detail) return `detail:${repository.toLowerCase()}`;
  return [
    "city-v2",
    owner.toLowerCase(),
    view || "recent",
    repository.toLowerCase() || "all",
    page,
  ].join(":");
}

function cacheHeaders(isExploreTarget: boolean) {
  return {
    "Cache-Control": isExploreTarget
      ? "public, s-maxage=86400, stale-while-revalidate=604800"
      : "public, s-maxage=900, stale-while-revalidate=86400",
  };
}

export async function GET(request: NextRequest) {
  const requestedOwner =
    request.nextUrl.searchParams.get("owner")?.trim() ?? "";
  const focusedRepository =
    request.nextUrl.searchParams.get("repo")?.trim() ?? "";
  const repositoryOwner = focusedRepository.split("/")[0] ?? "";
  const owner = focusedRepository ? repositoryOwner : requestedOwner;
  const view = request.nextUrl.searchParams.get("view")?.trim() ?? "";
  const requestedPage = Number(
    request.nextUrl.searchParams.get("page") ?? "1",
  );
  const page = Number.isFinite(requestedPage)
    ? Math.max(1, Math.min(10_000, Math.floor(requestedPage)))
    : 1;
  const requestedOwnerType = request.nextUrl.searchParams.get("ownerType");
  const detail = request.nextUrl.searchParams.get("detail") === "1";

  if (!OWNER_PATTERN.test(owner)) {
    return NextResponse.json(
      { error: "Enter a valid GitHub username or organization." },
      { status: 400 },
    );
  }
  if (focusedRepository && !REPOSITORY_PATTERN.test(focusedRepository)) {
    return NextResponse.json(
      { error: "Enter a valid repository in owner/name format." },
      { status: 400 },
    );
  }
  if (detail && !focusedRepository) {
    return NextResponse.json(
      { error: "Select a repository to load detailed metrics." },
      { status: 400 },
    );
  }
  if (view && view !== "popular") {
    return NextResponse.json(
      { error: "That repository view is not supported." },
      { status: 400 },
    );
  }
  if (
    requestedOwnerType &&
    requestedOwnerType !== "organization" &&
    requestedOwnerType !== "user"
  ) {
    return NextResponse.json(
      { error: "That GitHub owner type is not supported." },
      { status: 400 },
    );
  }

  const exploreTarget = isCachedExploreTarget(owner);
  const key = cacheKey({
    owner,
    page,
    view,
    repository: focusedRepository,
    detail,
  });

  if (exploreTarget) {
    const cached = await readGithubCache<GitHubPagePayload | {
      repository: RepositorySignal;
    }>(key);
    if (cached) {
      return NextResponse.json(cached, { headers: cacheHeaders(true) });
    }
  }

  try {
    if (detail) {
      const repositoryResponse = await fetchGitHub(
        `/repos/${focusedRepository
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`,
      );
      if (!repositoryResponse.ok) {
        return NextResponse.json(
          { error: githubError(repositoryResponse.status) },
          { status: repositoryResponse.status },
        );
      }
      const repository = (await repositoryResponse.json()) as GitHubRepository;
      const metrics = await collectRepoMetrics(repository);
      const payload = { repository: normalizeRepository(repository, metrics) };
      if (exploreTarget) {
        await writeGithubCache(
          key,
          owner,
          payload,
          EXPLORE_CACHE_TTL,
        );
      }
      return NextResponse.json(payload, {
        headers: cacheHeaders(exploreTarget),
      });
    }

    let ownerType = requestedOwnerType as OwnerType | null;
    let ownerAvatarUrl: string | null = null;
    let totalRepositories: number | null = null;

    if (!ownerType || page === 1) {
      const ownerResponse = await fetchGitHub(
        `/users/${encodeURIComponent(owner)}`,
      );
      if (!ownerResponse.ok) {
        return NextResponse.json(
          { error: githubError(ownerResponse.status) },
          { status: ownerResponse.status },
        );
      }
      const identity = (await ownerResponse.json()) as GitHubOwner;
      ownerType = ownerTypeFromIdentity(identity);
      ownerAvatarUrl = identity.avatar_url;
      totalRepositories = identity.public_repos;
    }

    const repositoryPath =
      ownerType === "organization"
        ? `/orgs/${encodeURIComponent(owner)}/repos?per_page=${PAGE_SIZE}&page=${page}&sort=pushed&direction=desc&type=public`
        : `/users/${encodeURIComponent(owner)}/repos?per_page=${PAGE_SIZE}&page=${page}&sort=pushed&direction=desc&type=owner`;
    const repositoryResponse = await fetchGitHub(repositoryPath);
    if (!repositoryResponse.ok) {
      return NextResponse.json(
        { error: githubError(repositoryResponse.status) },
        { status: repositoryResponse.status },
      );
    }

    const listedRepositories =
      (await repositoryResponse.json()) as GitHubRepository[];
    let repositories = listedRepositories;

    if (focusedRepository && page === 1) {
      const alreadyIncluded = listedRepositories.some(
        (repo) =>
          repo.full_name.toLowerCase() === focusedRepository.toLowerCase(),
      );
      if (!alreadyIncluded) {
        const focusResponse = await fetchGitHub(
          `/repos/${focusedRepository
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
        );
        if (focusResponse.ok) {
          repositories = [
            (await focusResponse.json()) as GitHubRepository,
            ...repositories,
          ];
        }
      }
    }

    const normalized = repositories
      .filter(
        (repo) =>
          !repo.fork ||
          repo.full_name.toLowerCase() === focusedRepository.toLowerCase(),
      )
      .map((repo) => normalizeRepository(repo));
    const payload: GitHubPagePayload = {
      owner,
      ownerType,
      ownerAvatarUrl,
      repositories: normalized,
      page,
      perPage: PAGE_SIZE,
      hasMore: hasNextPage(repositoryResponse, listedRepositories.length),
      totalRepositories,
      view: view === "popular" || focusedRepository ? "popular" : "recent",
      focusedRepository: focusedRepository || null,
      collectedAt: new Date().toISOString(),
      cache: exploreTarget ? "durable" : "edge",
    };

    if (exploreTarget) {
      await writeGithubCache(
        key,
        owner,
        payload,
        EXPLORE_CACHE_TTL,
      );
    }

    return NextResponse.json(payload, {
      headers: cacheHeaders(exploreTarget),
    });
  } catch (error) {
    console.error("Git/City GitHub route failed", {
      owner,
      page,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          "GitHub is temporarily unreachable. Cached Explore cities and the demo are still available.",
      },
      { status: 502 },
    );
  }
}
