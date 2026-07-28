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
    // Uncommon languages share the same neutral-color neighborhood rather than
    // creating a collection of visually identical isolated districts.
    const district = languageColor(repo.language || "Other");
    const group = groups.get(district) ?? [];
    group.push(repo);
    groups.set(district, group);
  });

  const districtKeys = [...groups.keys()].sort((a, b) => {
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
  const createCityCells = (count: number): LayoutCell[] => {
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
        (a, b) => {
          const aEdgeNoise =
            ((hashString(`city-edge:${a.x}:${a.z}`) % 1000) / 1000 - 0.5) *
            0.38;
          const bEdgeNoise =
            ((hashString(`city-edge:${b.x}:${b.z}`) % 1000) / 1000 - 0.5) *
            0.38;
          return (
            a.radius +
              aEdgeNoise -
              (b.radius + bEdgeNoise) ||
          a.angle - b.angle ||
          a.x - b.x ||
            a.z - b.z
          );
        },
      )
      .slice(0, count);
  };

  // One uninterrupted grid keeps every neighborhood on the same street fabric.
  // The slightly noisy perimeter avoids both a rectangle and a perfect disc.
  const cityCells = createCityCells(repositories.length);
  const outerRadius = Math.max(1, ...cityCells.map((cell) => cell.radius));
  const districts = districtKeys.map((key) => {
    return {
      key,
      repositories: [...(groups.get(key) ?? [])],
      cells: [] as LayoutCell[],
      anchor: { x: 0, z: 0 },
    };
  });

  // Place neighborhood seeds close together, then let their blocks compete for
  // the nearest open cells. This creates connected, irregular color districts
  // with shared borders instead of separated circles.
  const availableAnchors = new Set(
    cityCells.map((cell) => `${cell.x}:${cell.z}`),
  );
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  districts.forEach((district, districtIndex) => {
    const anchorRadius =
      districtIndex === 0
        ? 0
        : outerRadius *
          (0.12 +
            0.26 *
              Math.sqrt(
                districtIndex / Math.max(1, districts.length - 1),
              ));
    const anchorAngle =
      -Math.PI / 2 +
      districtIndex * goldenAngle +
      ((hashString(district.key) % 31) / 31 - 0.5) * 0.35;
    const target = {
      x: Math.cos(anchorAngle) * anchorRadius,
      z: Math.sin(anchorAngle) * anchorRadius,
    };
    let nearestAnchor = cityCells[0];
    let nearestDistance = Infinity;
    cityCells.forEach((cell) => {
      if (!availableAnchors.has(`${cell.x}:${cell.z}`)) return;
      const distance = Math.hypot(cell.x - target.x, cell.z - target.z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestAnchor = cell;
      }
    });
    district.anchor = { x: nearestAnchor.x, z: nearestAnchor.z };
    availableAnchors.delete(`${nearestAnchor.x}:${nearestAnchor.z}`);
  });

  const preferences = new Map<string, LayoutCell[]>();
  districts.forEach((district) => {
    preferences.set(
      district.key,
      [...cityCells].sort((a, b) => {
        const distanceA = Math.hypot(
          a.x - district.anchor.x,
          a.z - district.anchor.z,
        );
        const distanceB = Math.hypot(
          b.x - district.anchor.x,
          b.z - district.anchor.z,
        );
        const edgeA =
          ((hashString(`${district.key}:${a.x}:${a.z}`) % 1000) / 1000 - 0.5) *
          0.9;
        const edgeB =
          ((hashString(`${district.key}:${b.x}:${b.z}`) % 1000) / 1000 - 0.5) *
          0.9;
        return (
          distanceA +
            edgeA -
            (distanceB + edgeB) ||
          a.radius - b.radius ||
          a.angle - b.angle
        );
      }),
    );
  });

  const claimedCells = new Set<string>();
  const preferenceIndexes = new Map<string, number>();
  let assignedCount = 0;
  while (assignedCount < cityCells.length) {
    districts.forEach((district) => {
      if (district.cells.length >= district.repositories.length) return;
      const orderedCells = preferences.get(district.key) ?? [];
      let preferenceIndex = preferenceIndexes.get(district.key) ?? 0;
      while (
        preferenceIndex < orderedCells.length &&
        claimedCells.has(
          `${orderedCells[preferenceIndex].x}:${orderedCells[preferenceIndex].z}`,
        )
      ) {
        preferenceIndex += 1;
      }
      const cell = orderedCells[preferenceIndex];
      if (!cell) return;
      district.cells.push(cell);
      claimedCells.add(`${cell.x}:${cell.z}`);
      preferenceIndexes.set(district.key, preferenceIndex + 1);
      assignedCount += 1;
    });
  }

  const streetCoordinate = (coordinate: number) =>
    coordinate * buildingSpacing +
    Math.sign(coordinate) *
      Math.floor(Math.abs(coordinate) / boulevardEvery) *
      boulevardWidth;

  districts.forEach((district) => {
    const districtRadius = Math.max(
      1,
      ...district.cells.map((cell) =>
        Math.hypot(
          cell.x - district.anchor.x,
          cell.z - district.anchor.z,
        ),
      ),
    );
    const hotspotCount =
      district.repositories.length >= 30
        ? 3
        : district.repositories.length >= 10
          ? 2
          : 1;
    const hotspotSeed = hashString(district.key);
    const hotspots = Array.from({ length: hotspotCount }, (_, index) => {
      if (index === 0) return district.anchor;
      const angle =
        ((hotspotSeed % 360) / 360) * Math.PI * 2 +
        (index / hotspotCount) * Math.PI * 2;
      const radius = districtRadius * (index % 2 === 0 ? 0.62 : 0.44);
      return {
        x: district.anchor.x + Math.cos(angle) * radius,
        z: district.anchor.z + Math.sin(angle) * radius,
      };
    });
    const organicCells = [...district.cells].sort((a, b) => {
      const priority = (cell: LayoutCell) => {
        const hotspotDistance =
          Math.min(
            ...hotspots.map((hotspot) =>
              Math.hypot(cell.x - hotspot.x, cell.z - hotspot.z),
            ),
          ) / districtRadius;
        const centrality = cell.radius / outerRadius;
        const texture =
          (hashString(`height:${district.key}:${cell.x}:${cell.z}`) % 1000) /
          1000;
        return hotspotDistance * 0.34 + centrality * 0.2 + texture * 0.46;
      };
      return (
        priority(a) - priority(b) ||
        a.radius - b.radius ||
        a.angle - b.angle
      );
    });
    const orderedRepositories = district.repositories
      .sort(
        (a, b) =>
          activityScore(b) - activityScore(a) ||
          a.fullName.localeCompare(b.fullName),
      );

    orderedRepositories.forEach((repo, cellIndex) => {
      const cell = organicCells[cellIndex];
      const seed = hashString(repo.fullName);
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
