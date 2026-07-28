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
  const buildingSpacing = 3.55;
  const boulevardEvery = 6;
  const boulevardWidth = 1.15;
  const placements = new Map<
    RepositorySignal["id"],
    { position: [number, number, number]; rotation: number }
  >();

  type LayoutCell = {
    x: number;
    z: number;
    radius: number;
    angle: number;
  };
  const createDistrictCells = (count: number): LayoutCell[] => {
    const searchRadius = Math.ceil(Math.sqrt(count)) + 2;
    const candidates: LayoutCell[] = [];
    for (let x = -searchRadius; x <= searchRadius; x += 1) {
      for (let z = -searchRadius; z <= searchRadius; z += 1) {
        candidates.push({
          x,
          z,
          radius: Math.hypot(x, z),
          angle: Math.atan2(z, x),
        });
      }
    }
    return candidates
      .sort(
        (a, b) =>
          a.radius - b.radius ||
          a.angle - b.angle ||
          a.x - b.x ||
          a.z - b.z,
      )
      .slice(0, count);
  };

  const districts = languages.map((language) => {
    const cells = createDistrictCells(groups.get(language)?.length ?? 0);
    return {
      language,
      repositories: [...(groups.get(language) ?? [])],
      cells,
      radius: Math.max(0, ...cells.map((cell) => cell.radius)) + 0.62,
      center: { x: 0, z: 0 },
    };
  });

  // Pack the color districts as separate digital circles. The largest language
  // anchors the city and smaller conglomerates take the nearest non-overlapping
  // grid position, keeping the overall footprint compact without comparing
  // every repository against every other open block.
  const placedDistricts: typeof districts = [];
  const districtGap = 1.35;
  districts.forEach((district, districtIndex) => {
    if (districtIndex > 0) {
      const startAngle =
        ((hashString(district.language) % 360) / 360) * Math.PI * 2;
      let foundCenter = false;
      const maxRing = Math.max(
        8,
        Math.ceil(
          placedDistricts.reduce(
            (total, placed) => total + placed.radius + districtGap,
            district.radius,
          ),
        ),
      );

      for (let ring = 1; ring <= maxRing && !foundCenter; ring += 1) {
        const samples = Math.max(8, Math.ceil(Math.PI * 2 * ring * 1.5));
        const seen = new Set<string>();
        for (let sample = 0; sample < samples; sample += 1) {
          const angle = startAngle + (sample / samples) * Math.PI * 2;
          const candidate = {
            x: Math.round(Math.cos(angle) * ring),
            z: Math.round(Math.sin(angle) * ring),
          };
          const candidateKey = `${candidate.x}:${candidate.z}`;
          if (seen.has(candidateKey)) continue;
          seen.add(candidateKey);

          const hasRoom = placedDistricts.every(
            (placed) =>
              Math.hypot(
                candidate.x - placed.center.x,
                candidate.z - placed.center.z,
              ) >=
              district.radius + placed.radius + districtGap,
          );
          if (hasRoom) {
            district.center = candidate;
            foundCenter = true;
            break;
          }
        }
      }
    }
    placedDistricts.push(district);
  });

  const streetCoordinate = (coordinate: number) =>
    coordinate * buildingSpacing +
    Math.sign(coordinate) *
      Math.floor(Math.abs(coordinate) / boulevardEvery) *
      boulevardWidth;

  placedDistricts.forEach((district) => {
    const scatterRange = Math.min(
      8,
      Math.max(1.5, Math.sqrt(district.repositories.length) * 0.42),
    );
    const orderedRepositories = district.repositories
      .sort(
        (a, b) =>
          activityScore(b) - activityScore(a) ||
          a.fullName.localeCompare(b.fullName),
      )
      .map((repo, activityRank) => ({
        repo,
        placementRank:
          activityRank +
          (((hashString(repo.fullName) >>> 16) & 255) / 255) * scatterRange,
      }))
      .sort(
        (a, b) =>
          a.placementRank - b.placementRank ||
          a.repo.fullName.localeCompare(b.repo.fullName),
      );

    orderedRepositories.forEach(({ repo }, cellIndex) => {
      const cell = district.cells[cellIndex];
      const seed = hashString(repo.fullName);
      const jitterX = ((seed & 255) / 255 - 0.5) * 0.3;
      const jitterZ = (((seed >> 8) & 255) / 255 - 0.5) * 0.3;
      placements.set(repo.id, {
        position: [
          streetCoordinate(district.center.x + cell.x) + jitterX,
          0,
          streetCoordinate(district.center.z + cell.z) + jitterZ,
        ],
        rotation: ((seed % 5) - 2) * 0.014,
      });
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
