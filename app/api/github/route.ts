import { NextRequest, NextResponse } from "next/server";
import type { RepositorySignal } from "@/lib/city-model";

const GITHUB_API = "https://api.github.com";
const OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const REPOSITORY_PATTERN =
  /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[a-z\d._-]{1,100}$/i;
const MAX_REPOSITORIES = 18;

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
  owner?: {
    login: string;
    type: "Organization" | "User";
  };
};

type GitHubOwner = {
  login: string;
  type: "Organization" | "User";
};

type GitHubSearchResponse = {
  items: GitHubRepository[];
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
  return fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(),
    next: { revalidate: 900 },
  });
}

function countFromPaginatedResponse(response: Response, itemCount: number) {
  const link = response.headers.get("link") ?? "";
  const lastPage = link.match(/[?&]page=(\d+)>;\s*rel="last"/)?.[1];
  return lastPage ? Number(lastPage) : itemCount;
}

async function collectRepoMetrics(repo: GitHubRepository) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [repositoryOwner, repositoryName] = repo.full_name.split("/");
  const base = `/repos/${encodeURIComponent(repositoryOwner)}/${encodeURIComponent(repositoryName)}`;
  const [commitsResponse, contributorsResponse] = await Promise.all([
    fetchGitHub(`${base}/commits?since=${encodeURIComponent(since)}&per_page=1`),
    fetchGitHub(`${base}/contributors?anon=1&per_page=1`),
  ]);

  const commits =
    commitsResponse.ok
      ? ((await commitsResponse.json()) as unknown[])
      : [];
  const contributors =
    contributorsResponse.ok
      ? ((await contributorsResponse.json()) as unknown[])
      : [];

  return {
    commits30d: commitsResponse.ok
      ? countFromPaginatedResponse(commitsResponse, commits.length)
      : new Date(repo.pushed_at).getTime() >
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ? 1
        : 0,
    contributorCount: contributorsResponse.ok
      ? countFromPaginatedResponse(contributorsResponse, contributors.length)
      : 1,
  };
}

function githubError(status: number) {
  return status === 403 || status === 429
    ? "GitHub’s public request limit is busy. Try the demo city or wait a few minutes."
    : "That GitHub owner could not be loaded.";
}

async function fetchPopularRepositories(
  owner: string,
  ownerType: "organization" | "user",
) {
  const qualifier = ownerType === "organization" ? "org" : "user";
  const query = `${qualifier}:${owner} fork:false archived:false`;
  return fetchGitHub(
    `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${MAX_REPOSITORIES}`,
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export async function GET(request: NextRequest) {
  const requestedOwner =
    request.nextUrl.searchParams.get("owner")?.trim() ?? "";
  const focusedRepository =
    request.nextUrl.searchParams.get("repo")?.trim() ?? "";
  const view = request.nextUrl.searchParams.get("view")?.trim() ?? "";
  const repositoryOwner = focusedRepository.split("/")[0] ?? "";
  const owner = focusedRepository ? repositoryOwner : requestedOwner;

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
  if (view && view !== "popular") {
    return NextResponse.json(
      { error: "That repository view is not supported." },
      { status: 400 },
    );
  }

  try {
    let ownerType: "organization" | "user" = "organization";
    let rawRepositories: GitHubRepository[] = [];
    const wantsPopular = view === "popular" || Boolean(focusedRepository);

    if (wantsPopular) {
      const [ownerResponse, focusResponse] = await Promise.all([
        fetchGitHub(`/users/${encodeURIComponent(owner)}`),
        focusedRepository
          ? fetchGitHub(
              `/repos/${focusedRepository
                .split("/")
                .map(encodeURIComponent)
                .join("/")}`,
            )
          : Promise.resolve(null),
      ]);

      if (!ownerResponse.ok) {
        return NextResponse.json(
          { error: githubError(ownerResponse.status) },
          { status: ownerResponse.status },
        );
      }
      if (focusResponse && !focusResponse.ok) {
        return NextResponse.json(
          {
            error:
              focusResponse.status === 404
                ? "That featured repository could not be loaded."
                : githubError(focusResponse.status),
          },
          { status: focusResponse.status },
        );
      }

      const ownerIdentity = (await ownerResponse.json()) as GitHubOwner;
      ownerType =
        ownerIdentity.type === "Organization" ? "organization" : "user";
      const repositoryResponse = await fetchPopularRepositories(owner, ownerType);

      if (!repositoryResponse.ok) {
        return NextResponse.json(
          { error: githubError(repositoryResponse.status) },
          { status: repositoryResponse.status },
        );
      }

      const search = (await repositoryResponse.json()) as GitHubSearchResponse;
      const focus = focusResponse
        ? ((await focusResponse.json()) as GitHubRepository)
        : null;
      rawRepositories = focus
        ? [
            focus,
            ...search.items.filter((repo) => repo.full_name !== focus.full_name),
          ]
        : search.items;
    } else {
      let repositoryResponse = await fetchGitHub(
        `/orgs/${encodeURIComponent(owner)}/repos?per_page=${MAX_REPOSITORIES}&sort=pushed&type=public`,
      );

      if (repositoryResponse.status === 404) {
        ownerType = "user";
        repositoryResponse = await fetchGitHub(
          `/users/${encodeURIComponent(owner)}/repos?per_page=${MAX_REPOSITORIES}&sort=pushed&type=owner`,
        );
      }

      if (!repositoryResponse.ok) {
        return NextResponse.json(
          { error: githubError(repositoryResponse.status) },
          { status: repositoryResponse.status },
        );
      }
      rawRepositories =
        (await repositoryResponse.json()) as GitHubRepository[];
    }

    const repositories = rawRepositories
      .filter(
        (repo) =>
          !repo.fork || repo.full_name.toLowerCase() === focusedRepository.toLowerCase(),
      )
      .slice(0, MAX_REPOSITORIES);
    const metrics = await mapWithConcurrency(repositories, 4, collectRepoMetrics);

    const normalized: RepositorySignal[] = repositories.map((repo, index) => ({
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
      commits30d: metrics[index].commits30d,
      mergedPullRequests30d: 0,
      closedIssues30d: 0,
      openedIssues30d: 0,
      contributorCount: metrics[index].contributorCount,
    }));

    return NextResponse.json(
      {
        owner,
        ownerType,
        repositories: normalized,
        view: wantsPopular ? "popular" : "recent",
        focusedRepository: focusedRepository || null,
        collectedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": wantsPopular
            ? "public, s-maxage=3600, stale-while-revalidate=86400"
            : "public, s-maxage=900, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "GitHub is temporarily unreachable. The demo city is still available." },
      { status: 502 },
    );
  }
}
