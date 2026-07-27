"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  ArrowUpRight,
  Box,
  Building2,
  ChevronDown,
  Compass,
  GitFork,
  GitCommitHorizontal,
  Info,
  Rotate3D,
  Search,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  activityScore,
  buildCity,
  summarizeCity,
  type CityBuilding,
  type RepositorySignal,
} from "@/lib/city-model";
import { demoRepositories } from "@/lib/demo-data";
import { featuredOrganizations } from "@/lib/discovery";

const CityScene = dynamic(
  () => import("./CityScene").then((module) => module.CityScene),
  {
    ssr: false,
    loading: () => (
      <div className="scene-loading" role="status">
        <span className="scene-loading-orbit" />
        <span>Assembling skyline</span>
      </div>
    ),
  },
);

type FilterMode = "all" | "active" | "popular" | "archived";
type HistoryMode = "none" | "push";

type CityTarget = {
  owner: string;
  view?: "popular";
  repository?: string;
  sourceLabel?: string;
};

type GitHubPagePayload = {
  error?: string;
  owner: string;
  ownerType: "organization" | "user";
  ownerAvatarUrl: string | null;
  repositories: RepositorySignal[];
  page: number;
  hasMore: boolean;
  totalRepositories: number | null;
  focusedRepository: string | null;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);

const timeAgo = (isoDate: string) => {
  const days = Math.max(
    0,
    Math.round((Date.now() - new Date(isoDate).getTime()) / 86_400_000),
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
};

export function GitCityExperience() {
  const [repositories, setRepositories] =
    useState<RepositorySignal[]>(demoRepositories);
  const [owner, setOwner] = useState("");
  const [cityName, setCityName] = useState("OPEN CITY LABS");
  const [sourceLabel, setSourceLabel] = useState("CURATED DEMO");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [language, setLanguage] = useState("All languages");
  const [selectedId, setSelectedId] = useState<CityBuilding["id"] | null>(null);
  const [hoveredId, setHoveredId] = useState<CityBuilding["id"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [repositoryTotal, setRepositoryTotal] = useState(demoRepositories.length);
  const [ownerAvatarUrl, setOwnerAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const searchHubRef = useRef<HTMLDivElement>(null);
  const loadGenerationRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setDiscoveryOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!discoveryOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!searchHubRef.current?.contains(event.target as Node)) {
        setDiscoveryOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [discoveryOpen]);

  const allBuildings = useMemo(() => buildCity(repositories), [repositories]);
  const languages = useMemo(
    () =>
      [...new Set(repositories.map((repo) => repo.language || "Other"))].sort(),
    [repositories],
  );
  const popularThreshold = useMemo(() => {
    const stars = repositories.map((repo) => repo.stars).sort((a, b) => b - a);
    return stars[Math.max(0, Math.floor(stars.length * 0.35) - 1)] ?? 0;
  }, [repositories]);
  const activeThreshold = useMemo(() => {
    const scores = repositories.map(activityScore).sort((a, b) => b - a);
    return scores[Math.max(0, Math.floor(scores.length * 0.55) - 1)] ?? 0;
  }, [repositories]);

  const buildings = useMemo(
    () =>
      allBuildings.filter((building) => {
        if (language !== "All languages" && building.language !== language) {
          return false;
        }
        if (filter === "active") return building.activityScore >= activeThreshold;
        if (filter === "popular") return building.stars >= popularThreshold;
        if (filter === "archived") return building.archived;
        return true;
      }),
    [activeThreshold, allBuildings, filter, language, popularThreshold],
  );

  const summary = useMemo(() => summarizeCity(repositories), [repositories]);
  const selected =
    allBuildings.find((building) => building.id === selectedId) ?? null;
  const hovered =
    allBuildings.find((building) => building.id === hoveredId) ?? null;

  const loadTarget = useCallback(async (
    target: CityTarget,
    historyMode: HistoryMode = "push",
  ) => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setIsLoading(true);
    setIsStreaming(false);
    setError("");
    setSelectedId(null);
    setHoveredId(null);
    setDiscoveryOpen(false);

    try {
      const query = new URLSearchParams({ owner: target.owner, page: "1" });
      if (target.view) query.set("view", target.view);
      if (target.repository) query.set("repo", target.repository);
      const response = await fetch(`/api/github?${query.toString()}`, {
        signal: controller.signal,
      });
      const payload = (await response.json()) as GitHubPagePayload;
      if (!response.ok || !payload.repositories) {
        throw new Error(payload.error ?? "This city could not be loaded.");
      }
      if (generation !== loadGenerationRef.current) return;
      if (payload.repositories.length === 0) {
        throw new Error("No public, original repositories were found for that owner.");
      }
      let collected = payload.repositories;
      setRepositories(collected);
      setOwner(payload.owner ?? target.owner);
      setOwnerAvatarUrl(payload.ownerAvatarUrl);
      setRepositoryTotal(payload.totalRepositories ?? collected.length);
      setCityName(
        (payload.owner ?? target.owner).replace(/-/g, " ").toUpperCase(),
      );
      setSourceLabel(
        target.sourceLabel ??
          `LIVE ${payload.ownerType?.toUpperCase() ?? "GITHUB"}`,
      );
      setFilter("all");
      setLanguage("All languages");
      const focused = payload.focusedRepository
        ? payload.repositories.find(
            (repo) =>
              repo.fullName.toLowerCase() ===
              payload.focusedRepository?.toLowerCase(),
          )
        : null;
      setSelectedId(focused?.id ?? null);

      if (historyMode === "push") {
        const url = new URL(window.location.href);
        url.search = "";
        if (target.repository) {
          url.searchParams.set("repo", target.repository);
        } else {
          url.searchParams.set("owner", target.owner);
          if (target.view) url.searchParams.set("view", target.view);
        }
        window.history.pushState(null, "", `${url.pathname}${url.search}`);
      }

      setIsLoading(false);
      setIsStreaming(payload.hasMore);

      let nextPage = 2;
      let hasMore = payload.hasMore;
      while (hasMore && generation === loadGenerationRef.current) {
        const pageQuery = new URLSearchParams({
          owner: payload.owner ?? target.owner,
          ownerType: payload.ownerType,
          page: String(nextPage),
        });
        if (target.view) pageQuery.set("view", target.view);
        const pageResponse = await fetch(
          `/api/github?${pageQuery.toString()}`,
          { signal: controller.signal },
        );
        const pagePayload = (await pageResponse.json()) as GitHubPagePayload;
        if (!pageResponse.ok || !pagePayload.repositories) {
          throw new Error(
            pagePayload.error ?? "The rest of this city could not be loaded.",
          );
        }
        if (generation !== loadGenerationRef.current) return;

        const byId = new Map(collected.map((repo) => [repo.id, repo]));
        pagePayload.repositories.forEach((repo) => byId.set(repo.id, repo));
        collected = [...byId.values()];
        setRepositories(collected);
        setRepositoryTotal((total) => Math.max(total, collected.length));
        hasMore = pagePayload.hasMore;
        nextPage += 1;
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "GitHub is temporarily unreachable.",
      );
    } finally {
      if (generation === loadGenerationRef.current) {
        setIsLoading(false);
        setIsStreaming(false);
      }
    }
  }, []);

  function loadCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = owner.trim().replace(/^@/, "");
    if (!target) return;
    void loadTarget({ owner: target });
  }

  const restoreDemo = useCallback((historyMode: HistoryMode = "push") => {
    loadGenerationRef.current += 1;
    loadAbortRef.current?.abort();
    setRepositories(demoRepositories);
    setOwner("");
    setOwnerAvatarUrl(null);
    setRepositoryTotal(demoRepositories.length);
    setIsLoading(false);
    setIsStreaming(false);
    setCityName("OPEN CITY LABS");
    setSourceLabel("CURATED DEMO");
    setFilter("all");
    setLanguage("All languages");
    setSelectedId(null);
    setHoveredId(null);
    setDiscoveryOpen(false);
    setError("");
    if (historyMode === "push") {
      window.history.pushState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!selected?.metricsEstimated) return;
    const controller = new AbortController();
    const repositoryId = selected.id;

    void (async () => {
      try {
        const query = new URLSearchParams({
          owner: selected.fullName.split("/")[0],
          repo: selected.fullName,
          detail: "1",
        });
        const response = await fetch(`/api/github?${query.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          repository?: RepositorySignal;
        };
        if (!response.ok || !payload.repository) return;
        setRepositories((current) =>
          current.map((repo) =>
            repo.id === repositoryId ? payload.repository! : repo,
          ),
        );
      } catch {
        // Estimated metrics remain useful when detailed enrichment is unavailable.
      }
    })();

    return () => controller.abort();
  }, [selected?.fullName, selected?.id, selected?.metricsEstimated]);

  useEffect(() => {
    const loadFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const repository = params.get("repo");
      const linkedOwner = params.get("owner");
      if (repository?.includes("/")) {
        void loadTarget(
          {
            owner: repository.split("/")[0],
            repository,
            view: "popular",
            sourceLabel: "FEATURED REPOSITORY",
          },
          "none",
        );
      } else if (linkedOwner) {
        const popular = params.get("view") === "popular";
        void loadTarget(
          {
            owner: linkedOwner,
            view: popular ? "popular" : undefined,
            sourceLabel: popular ? "FEATURED ORGANIZATION" : undefined,
          },
          "none",
        );
      } else {
        restoreDemo("none");
      }
    };

    loadFromLocation();
    window.addEventListener("popstate", loadFromLocation);
    return () => window.removeEventListener("popstate", loadFromLocation);
  }, [loadTarget, restoreDemo]);

  return (
    <main className="experience-shell">
      <div className="atmosphere atmosphere-one" />
      <div className="atmosphere atmosphere-two" />
      <div className="noise" />

      <section className="scene-wrap" aria-label="Interactive three-dimensional repository city">
        <CityScene
          buildings={buildings}
          selectedId={selectedId}
          onSelect={(building) => setSelectedId(building.id)}
          onHover={(building) => setHoveredId(building?.id ?? null)}
          reduceMotion={reduceMotion}
        />
      </section>

      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => restoreDemo()}
          aria-label="Restore demo city"
        >
          <span className="brand-mark">
            <Building2 size={17} strokeWidth={1.8} />
          </span>
          <span className="brand-type">
            GIT<span>/</span>CITY
          </span>
          <span className="brand-version">01</span>
        </button>

        <div className="search-hub" ref={searchHubRef}>
          <form className="owner-search" onSubmit={loadCity}>
            <button
              className="discovery-trigger"
              type="button"
              aria-expanded={discoveryOpen}
              aria-controls="discovery-panel"
              onClick={() => setDiscoveryOpen((open) => !open)}
            >
              <Compass size={14} aria-hidden="true" />
              <span>Explore</span>
              <ChevronDown
                className={discoveryOpen ? "open" : ""}
                size={12}
                aria-hidden="true"
              />
            </button>
            <span className="search-divider" aria-hidden="true" />
            {ownerAvatarUrl ? (
              <span
                className="owner-avatar"
                style={{ backgroundImage: `url("${ownerAvatarUrl}")` }}
                aria-hidden="true"
              />
            ) : (
              <GitFork size={15} aria-hidden="true" />
            )}
            <label className="sr-only" htmlFor="github-owner">
              GitHub username or organization
            </label>
            <input
              id="github-owner"
              value={owner}
              onChange={(event) => {
                setOwner(event.target.value);
                setOwnerAvatarUrl(null);
              }}
              placeholder="username or organization"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="build-city-button"
              type="submit"
              disabled={isLoading || owner.trim().length === 0}
            >
              {isLoading ? "Building…" : "Build city"}
              {!isLoading && <ArrowUpRight size={14} />}
            </button>
          </form>

          {discoveryOpen && (
            <section
              className="discovery-panel"
              id="discovery-panel"
              aria-label="Explore notable open source cities"
            >
              <div className="discovery-heading">
                <div>
                  <span>DISCOVERY INDEX</span>
                  <h2>Explore without searching</h2>
                </div>
                <small>Select an organization</small>
              </div>

              <div className="discovery-columns">
                <div className="discovery-group discovery-group-wide">
                  <div className="discovery-group-title">
                    <Building2 size={13} aria-hidden="true" />
                    <span>Popular organizations</span>
                  </div>
                  <div className="discovery-list discovery-list-organizations">
                    {featuredOrganizations.map((organization) => (
                      <button
                        key={organization.owner}
                        type="button"
                        onClick={() =>
                          void loadTarget({
                            owner: organization.owner,
                            view: "popular",
                            sourceLabel: "FEATURED ORGANIZATION",
                          })
                        }
                      >
                        <span className="discovery-monogram">
                          {organization.monogram}
                        </span>
                        <span>
                          <strong>{organization.name}</strong>
                          <small>{organization.description}</small>
                        </span>
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="system-status">
          <span className="live-dot" />
          <span>MODEL ONLINE</span>
          <span className="status-time">30D</span>
        </div>
      </header>

      <section className="city-intro" aria-labelledby="city-title">
        <div className="eyebrow">
          <span>{sourceLabel}</span>
          <span className="eyebrow-rule" />
          <span>
            {repositories.length.toLocaleString()}
            {isStreaming && repositoryTotal > repositories.length
              ? ` / ${repositoryTotal.toLocaleString()}`
              : ""}{" "}
            REPOSITORIES
          </span>
        </div>
        <h1 id="city-title">{cityName}</h1>
        <p>
          A living skyline shaped by code, community, and momentum.
          <span>Drag to orbit. Select a building to inspect.</span>
        </p>
      </section>

      <aside className="metrics-rail" aria-label="City summary">
        <div className="rail-label">
          <span>CITY SIGNALS</span>
          <Sparkles size={13} />
        </div>
        <Metric
          icon={<GitCommitHorizontal size={16} />}
          value={formatNumber(summary.totalCommits30d)}
          label={
            repositories.some((repo) => repo.metricsEstimated)
              ? "Activity signal"
              : "Commits / 30d"
          }
          accent="#63e7ff"
        />
        <Metric
          icon={<Star size={16} />}
          value={formatNumber(summary.totalStars)}
          label="Total stars"
          accent="#ffc96a"
        />
        <Metric
          icon={<Users size={16} />}
          value={formatNumber(summary.totalContributors)}
          label="Contributors"
          accent="#b995ff"
        />
        <Metric
          icon={<Activity size={16} />}
          value={`${summary.activeRepositories}/${repositories.length}`}
          label="Active repos"
          accent="#83f6ae"
        />
        <div className="primary-language">
          <span>PRIMARY DISTRICT</span>
          <strong>{summary.primaryLanguage}</strong>
        </div>
      </aside>

      <nav className="filter-dock" aria-label="City filters">
        <div className="view-mode">
          {(["all", "active", "popular", "archived"] as FilterMode[]).map(
            (mode) => (
              <button
                key={mode}
                type="button"
                className={filter === mode ? "active" : ""}
                onClick={() => setFilter(mode)}
              >
                {mode}
              </button>
            ),
          )}
        </div>
        <span className="dock-divider" />
        <label>
          <span className="sr-only">Filter by programming language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option>All languages</option>
            {languages.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <span className={`result-count ${isStreaming ? "streaming" : ""}`}>
          {isStreaming
            ? `${repositories.length.toLocaleString()} loaded`
            : `${buildings.length.toLocaleString()} visible`}
        </span>
      </nav>

      <div className="interaction-hint">
        <Rotate3D size={15} />
        <span>DRAG TO ORBIT</span>
        <span className="hint-dot" />
        <span>SCROLL TO ZOOM</span>
      </div>

      <section className="legend" aria-label="Visual model legend">
        <div>
          <span className="legend-line legend-height" />
          <p>
            <strong>HEIGHT</strong>
            Weighted activity
          </p>
        </div>
        <div>
          <span className="legend-line legend-windows" />
          <p>
            <strong>WINDOWS</strong>
            Stars · people · activity
          </p>
        </div>
        <div>
          <span className="legend-line legend-beacon" />
          <p>
            <strong>BEACON</strong>
            Recent push
          </p>
        </div>
        <div>
          <span className="legend-line legend-color" />
          <p>
            <strong>COLOR</strong>
            Primary language
          </p>
        </div>
        <div>
          <span className="legend-line legend-footprint" />
          <p>
            <strong>FORM</strong>
            Size · archived dark
          </p>
        </div>
      </section>

      {hovered && !selected && (
        <div className="hover-card" role="status">
          <span style={{ backgroundColor: hovered.accent }} />
          <div>
            <strong>{hovered.name}</strong>
            <small>
              {hovered.language} · {hovered.activityScore} activity
            </small>
          </div>
        </div>
      )}

      {selected && (
        <aside className="repo-panel" aria-label={`${selected.name} repository details`}>
          <div className="panel-accent" style={{ background: selected.accent }} />
          <button
            className="panel-close"
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="Close repository details"
          >
            <X size={17} />
          </button>
          <div className="panel-kicker">
            <span style={{ background: selected.accent }} />
            {selected.archived ? "archived" : selected.tier.replace("-", " ")} ·{" "}
            {selected.language}
          </div>
          <h2>{selected.name}</h2>
          <p className="panel-description">{selected.description}</p>

          <div className="panel-stats">
            <PanelStat
              label={
                selected.metricsEstimated
                  ? "Estimated activity"
                  : "Activity score"
              }
              value={selected.activityScore}
            />
            <PanelStat
              label={
                selected.metricsEstimated
                  ? "Estimated commits"
                  : "Commits / 30d"
              }
              value={selected.commits30d}
            />
            <PanelStat label="Stars" value={formatNumber(selected.stars)} />
            <PanelStat label="Contributors" value={selected.contributorCount} />
          </div>

          <div className="building-profile">
            <div className="profile-title">
              <Box size={14} />
              <span>BUILDING PROFILE</span>
            </div>
            <div className="profile-row">
              <span>Height</span>
              <strong>{selected.height.toFixed(1)} units</strong>
            </div>
            <div className="profile-row">
              <span>Levels</span>
              <strong>{selected.levelCount} activity floors</strong>
            </div>
            <div className="profile-row">
              <span>Windows</span>
              <strong>{selected.windowRows} rows × 3</strong>
            </div>
            <div className="profile-row">
              <span>Illumination</span>
              <strong>
                {Math.round(selected.brightness * 100)}% people ·{" "}
                {Math.round(selected.illumination * 100)}% activity
              </strong>
            </div>
            <div className="profile-row">
              <span>Rooftop beacon</span>
              <strong>{Math.round(selected.recentActivity * 100)}%</strong>
            </div>
            <div className="profile-row">
              <span>Last push</span>
              <strong>{timeAgo(selected.pushedAt)}</strong>
            </div>
          </div>

          <a
            className="github-link"
            href={selected.url}
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub
            <ArrowUpRight size={15} />
          </a>
          <p className="formula-note">
            Activity floors establish the window rows and stars can increase
            their three-pane capacity. Contributors set potential occupancy,
            while weighted 30-day activity controls how many panes illuminate
            and how strongly they glow. Repository size sets footprint, recent
            pushes power the beacon, and archived projects stay dark.
          </p>
        </aside>
      )}

      {error && (
        <div className="error-toast" role="alert">
          <Info size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}

      <div className={`loading-wash ${isLoading ? "visible" : ""}`} aria-hidden="true">
        <Search size={21} />
        <span>Surveying GitHub skyline</span>
      </div>
    </main>
  );
}

function Metric({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div className="metric">
      <span className="metric-icon" style={{ color: accent }}>
        {icon}
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function PanelStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
