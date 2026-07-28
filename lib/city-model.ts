export type RepositorySignal = {
  id: number | string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  sizeKb: number;
  createdAt: string;
  pushedAt: string;
  archived: boolean;
  isFork: boolean;
  commits30d: number;
  mergedPullRequests30d: number;
  closedIssues30d: number;
  openedIssues30d: number;
  contributorCount: number;
  metricsEstimated?: boolean;
};

export type BuildingTier = "low-rise" | "mid-rise" | "tower" | "landmark";

export type CityBuilding = RepositorySignal & {
  activityScore: number;
  brightness: number;
  illumination: number;
  height: number;
  width: number;
  depth: number;
  levelCount: number;
  windowCount: number;
  windowRows: number;
  recentActivity: number;
  tier: BuildingTier;
  accent: string;
  district: string;
  position: [number, number, number];
  rotation: number;
};

export type CitySummary = {
  totalStars: number;
  totalCommits30d: number;
  totalContributors: number;
  activeRepositories: number;
  primaryLanguage: string;
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Go: "#00add8",
  Rust: "#dea584",
  Java: "#b07219",
  Ruby: "#701516",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  PHP: "#4f5d95",
  Shell: "#89e051",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Other: "#7b858f",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(quantile, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function activityScore(repo: RepositorySignal): number {
  if (repo.archived) return 0;
  return (
    repo.commits30d +
    repo.mergedPullRequests30d * 3 +
    repo.closedIssues30d * 2 +
    repo.openedIssues30d
  );
}

export function languageColor(language: string): string {
  return LANGUAGE_COLORS[language] ?? LANGUAGE_COLORS.Other;
}

function createLayout(repositories: RepositorySignal[]) {
  const groups = new Map<string, RepositorySignal[]>();
  repositories.forEach((repo) => {
    const district = repo.language || "Other";
    const group = groups.get(district) ?? [];
    group.push(repo);
    groups.set(district, group);
  });

  const languages = [...groups.keys()].sort((a, b) => {
    const sizeDelta = (groups.get(b)?.length ?? 0) - (groups.get(a)?.length ?? 0);
    return sizeDelta || a.localeCompare(b);
  });
  const languageAnchors = new Map<string, number>();
  let languageOffset = 0;
  languages.forEach((language) => {
    const share = (groups.get(language)?.length ?? 0) / repositories.length;
    languageAnchors.set(
      language,
      -Math.PI / 2 + (languageOffset + share / 2) * Math.PI * 2,
    );
    languageOffset += share;
  });

  const orderedRepositories = [...repositories].sort(
    (a, b) =>
      activityScore(b) - activityScore(a) ||
      a.fullName.localeCompare(b.fullName),
  );
  const buildingSpacing = 3.55;
  const boulevardEvery = 6;
  const boulevardWidth = 1.15;
  const placements = new Map<
    RepositorySignal["id"],
    { position: [number, number, number]; rotation: number }
  >();

  // Filling the nearest square-grid cells first produces a dense "digital
  // circle": a recognizable conglomerate with blocky streets and an irregular
  // stepped perimeter instead of a rectangular row-major footprint.
  const searchRadius = Math.ceil(Math.sqrt(repositories.length)) + 2;
  const cells = Array.from(
    { length: searchRadius * 2 + 1 },
    (_, xIndex) => xIndex - searchRadius,
  )
    .flatMap((x) =>
      Array.from(
        { length: searchRadius * 2 + 1 },
        (_, zIndex) => zIndex - searchRadius,
      ).map((z) => ({
        x,
        z,
        radius: Math.hypot(x, z),
        angle: Math.atan2(z, x),
      })),
    )
    .sort(
      (a, b) =>
        a.radius - b.radius ||
        a.angle - b.angle ||
        a.x - b.x ||
        a.z - b.z,
    )
    .slice(0, repositories.length)
    .map((cell, radialRank) => ({ ...cell, radialRank }));
  const outerRadius = Math.max(1, ...cells.map((cell) => cell.radius));
  const availableCells = [...cells];
  const activityScatter = Math.min(
    12,
    Math.max(2, Math.sqrt(repositories.length) * 0.45),
  );
  const angularDistance = (first: number, second: number) => {
    const difference = Math.abs(first - second) % (Math.PI * 2);
    return Math.min(difference, Math.PI * 2 - difference);
  };
  const streetCoordinate = (coordinate: number) =>
    coordinate * buildingSpacing +
    Math.sign(coordinate) *
      Math.floor(Math.abs(coordinate) / boulevardEvery) *
      boulevardWidth;

  orderedRepositories.forEach((repo, activityRank) => {
    const seed = hashString(repo.fullName);
    const rankNoise = ((seed >>> 16) & 255) / 255;
    const tallBand = Math.max(3, Math.ceil(repositories.length * 0.15));
    const scatter =
      activityRank < tallBand
        ? rankNoise * activityScatter
        : (rankNoise - 0.5) * activityScatter * 2;
    const targetRank = clamp(
      activityRank + scatter,
      0,
      repositories.length - 1,
    );
    const districtAngle =
      languageAnchors.get(repo.language || "Other") ?? -Math.PI / 2;
    let bestCellIndex = 0;
    let bestCost = Infinity;

    availableCells.forEach((cell, cellIndex) => {
      const radialCost =
        (Math.abs(cell.radialRank - targetRank) /
          Math.max(1, repositories.length - 1)) *
        5;
      // Angle matters progressively more away from the core, producing broad,
      // readable language neighborhoods without turning them into rigid slices.
      const districtCost =
        (angularDistance(cell.angle, districtAngle) / Math.PI) *
        1.35 *
        Math.sqrt(cell.radius / outerRadius);
      const tieBreak =
        (hashString(`${repo.fullName}:${cell.x}:${cell.z}`) % 997) / 997_000;
      const cost = radialCost + districtCost + tieBreak;
      if (cost < bestCost) {
        bestCost = cost;
        bestCellIndex = cellIndex;
      }
    });

    const [cell] = availableCells.splice(bestCellIndex, 1);
    const jitterX = ((seed & 255) / 255 - 0.5) * 0.3;
    const jitterZ = (((seed >> 8) & 255) / 255 - 0.5) * 0.3;
    placements.set(repo.id, {
      position: [
        streetCoordinate(cell.x) + jitterX,
        0,
        streetCoordinate(cell.z) + jitterZ,
      ],
      rotation: ((seed % 5) - 2) * 0.014,
    });
  });

  return placements;
}

export function buildCity(
  repositories: RepositorySignal[],
  referenceTime = Date.now(),
): CityBuilding[] {
  if (repositories.length === 0) return [];

  const scores = repositories.map(activityScore);
  const activityCeiling = Math.max(1, percentile(scores.map(Math.log1p), 0.95));
  const starCeiling = Math.max(
    1,
    percentile(repositories.map((repo) => Math.log1p(repo.stars)), 0.95),
  );
  const contributorCeiling = Math.max(
    1,
    percentile(
      repositories.map((repo) => Math.log1p(repo.contributorCount)),
      0.95,
    ),
  );
  const sizeCeiling = Math.max(
    1,
    percentile(repositories.map((repo) => Math.log1p(repo.sizeKb)), 0.9),
  );
  const placements = createLayout(repositories);

  return repositories.map((repo) => {
    const score = activityScore(repo);
    const activityNormalized = clamp(Math.log1p(score) / activityCeiling, 0, 1.15);
    const starsNormalized = clamp(Math.log1p(repo.stars) / starCeiling, 0, 1);
    const contributorsNormalized = clamp(
      Math.log1p(repo.contributorCount) / contributorCeiling,
      0,
      1,
    );
    const sizeNormalized = clamp(Math.log1p(repo.sizeKb) / sizeCeiling, 0, 1);
    const height = repo.archived ? 1.4 : 2.2 + activityNormalized * 24.2;
    const width = 1.8 + Math.sqrt(sizeNormalized) * 1.35;
    const levelCount = Math.max(
      4,
      Math.min(32, Math.round(height / 0.82)),
    );
    const activityWindowRows = height < 3.2 ? 3 : levelCount;
    const starWindowRows = Math.max(
      3,
      Math.min(18, Math.round(3 + starsNormalized * 15)),
    );
    const windowRows = Math.max(activityWindowRows, starWindowRows);
    const brightness = repo.archived ? 0 : contributorsNormalized;
    const illumination = repo.archived
      ? 0
      : clamp(activityNormalized, 0, 1);
    const pushedTime = new Date(repo.pushedAt).getTime();
    const daysSincePush = Number.isFinite(pushedTime)
      ? Math.max(0, (referenceTime - pushedTime) / 86_400_000)
      : 30;
    const recentActivity = repo.archived
      ? 0
      : clamp(1 - daysSincePush / 30, 0, 1);
    const tier: BuildingTier =
      height > 24
        ? "landmark"
        : height > 15
          ? "tower"
          : height > 7.5
            ? "mid-rise"
            : "low-rise";
    const placement = placements.get(repo.id) ?? {
      position: [0, 0, 0] as [number, number, number],
      rotation: 0,
    };

    return {
      ...repo,
      activityScore: score,
      brightness,
      illumination,
      height,
      width,
      depth: width * (0.8 + ((hashString(repo.name) >> 4) % 18) / 100),
      levelCount,
      windowCount: windowRows * 3,
      windowRows,
      recentActivity,
      tier,
      accent: languageColor(repo.language),
      district: repo.language || "Other",
      position: placement.position,
      rotation: placement.rotation,
    };
  });
}

export function summarizeCity(repositories: RepositorySignal[]): CitySummary {
  const languageCounts = new Map<string, number>();
  const activeCutoff = Date.now() - 1000 * 60 * 60 * 24 * 60;

  repositories.forEach((repo) => {
    const language = repo.language || "Other";
    languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
  });

  const primaryLanguage =
    [...languageCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? "—";

  return {
    totalStars: repositories.reduce((total, repo) => total + repo.stars, 0),
    totalCommits30d: repositories.reduce(
      (total, repo) => total + repo.commits30d,
      0,
    ),
    totalContributors: repositories.reduce(
      (total, repo) => total + repo.contributorCount,
      0,
    ),
    activeRepositories: repositories.filter(
      (repo) => !repo.archived && new Date(repo.pushedAt).getTime() >= activeCutoff,
    ).length,
    primaryLanguage,
  };
}
