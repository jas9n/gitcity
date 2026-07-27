"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  ArrowUpRight,
  Box,
  Building2,
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
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  activityScore,
  buildCity,
  summarizeCity,
  type CityBuilding,
  type RepositorySignal,
} from "@/lib/city-model";
import { demoRepositories } from "@/lib/demo-data";

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
  const [error, setError] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

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

  async function loadCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = owner.trim().replace(/^@/, "");
    if (!target) return;

    setIsLoading(true);
    setError("");
    setSelectedId(null);

    try {
      const response = await fetch(`/api/github?owner=${encodeURIComponent(target)}`);
      const payload = (await response.json()) as {
        error?: string;
        owner?: string;
        ownerType?: string;
        repositories?: RepositorySignal[];
      };
      if (!response.ok || !payload.repositories) {
        throw new Error(payload.error ?? "This city could not be loaded.");
      }
      if (payload.repositories.length === 0) {
        throw new Error("No public, original repositories were found for that owner.");
      }
      setRepositories(payload.repositories);
      setCityName((payload.owner ?? target).replace(/-/g, " ").toUpperCase());
      setSourceLabel(`LIVE ${payload.ownerType?.toUpperCase() ?? "GITHUB"}`);
      setFilter("all");
      setLanguage("All languages");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "GitHub is temporarily unreachable.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function restoreDemo() {
    setRepositories(demoRepositories);
    setCityName("OPEN CITY LABS");
    setSourceLabel("CURATED DEMO");
    setFilter("all");
    setLanguage("All languages");
    setSelectedId(null);
    setError("");
  }

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
        <button className="brand" type="button" onClick={restoreDemo} aria-label="Restore demo city">
          <span className="brand-mark">
            <Building2 size={17} strokeWidth={1.8} />
          </span>
          <span className="brand-type">
            GIT<span>/</span>CITY
          </span>
          <span className="brand-version">01</span>
        </button>

        <form className="owner-search" onSubmit={loadCity}>
          <GitFork size={15} aria-hidden="true" />
          <label className="sr-only" htmlFor="github-owner">
            GitHub username or organization
          </label>
          <input
            id="github-owner"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="username or organization"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" disabled={isLoading || owner.trim().length === 0}>
            {isLoading ? "Building…" : "Build city"}
            {!isLoading && <ArrowUpRight size={14} />}
          </button>
        </form>

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
          <span>{repositories.length.toString().padStart(2, "0")} REPOSITORIES</span>
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
          label="Commits / 30d"
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
        <span className="result-count">{buildings.length} visible</span>
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
          <span className="legend-line legend-light" />
          <p>
            <strong>LIGHT</strong>
            Stars + people
          </p>
        </div>
        <div>
          <span className="legend-line legend-color" />
          <p>
            <strong>COLOR</strong>
            Primary language
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
            {selected.tier.replace("-", " ")} · {selected.language}
          </div>
          <h2>{selected.name}</h2>
          <p className="panel-description">{selected.description}</p>

          <div className="panel-stats">
            <PanelStat label="Activity score" value={selected.activityScore} />
            <PanelStat label="Commits / 30d" value={selected.commits30d} />
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
              <span>Occupancy glow</span>
              <strong>{Math.round(selected.brightness * 100)}%</strong>
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
            Height uses logarithmic scaling across commits, pull requests, and
            issue activity so every repository remains visible.
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
