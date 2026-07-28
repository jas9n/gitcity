import { describe, expect, it } from "vitest";
import {
  activityScore,
  buildCity,
  hashString,
  languageColor,
  percentile,
  type RepositorySignal,
} from "./city-model";

const repo = (overrides: Partial<RepositorySignal> = {}): RepositorySignal => ({
  id: 1,
  name: "core",
  fullName: "example/core",
  description: "",
  url: "https://github.com/example/core",
  language: "TypeScript",
  stars: 100,
  forks: 12,
  openIssues: 4,
  sizeKb: 8000,
  createdAt: "2024-01-01T00:00:00Z",
  pushedAt: new Date().toISOString(),
  archived: false,
  isFork: false,
  commits30d: 10,
  mergedPullRequests30d: 4,
  closedIssues30d: 3,
  openedIssues30d: 2,
  contributorCount: 8,
  ...overrides,
});

describe("city model", () => {
  it("weights development activity according to the product model", () => {
    expect(activityScore(repo())).toBe(30);
    expect(activityScore(repo({ archived: true }))).toBe(0);
  });

  it("interpolates percentiles and handles an empty collection", () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([0, 10, 20, 30], 0.5)).toBe(15);
  });

  it("uses logarithmic scaling so outliers remain navigable", () => {
    const city = buildCity([
      repo({ id: 1, fullName: "x/quiet", commits30d: 2 }),
      repo({ id: 2, fullName: "x/busy", commits30d: 2000 }),
    ]);
    expect(city[1].height).toBeLessThan(city[0].height * 6);
    expect(city[1].height).toBeGreaterThan(25);
    expect(city[1].height).toBeLessThanOrEqual(31);
    expect(city[1].levelCount).toBeGreaterThan(city[0].levelCount);
    expect(city[1].levelCount).toBeLessThanOrEqual(32);
    expect(city.every((building) => Number.isFinite(building.height))).toBe(true);
  });

  it("produces stable positions from repository identity", () => {
    const first = buildCity([
      repo({ id: 1, fullName: "x/a" }),
      repo({ id: 2, fullName: "x/b", language: "Python" }),
    ]);
    const second = buildCity([
      repo({ id: 1, fullName: "x/a" }),
      repo({ id: 2, fullName: "x/b", language: "Python" }),
    ]);
    expect(second.map((building) => building.position)).toEqual(
      first.map((building) => building.position),
    );
    expect(hashString("x/a")).toBe(hashString("x/a"));
  });

  it("lays out large cities with finite, distributed coordinates", () => {
    const city = buildCity(
      Array.from({ length: 1_000 }, (_, index) =>
        repo({
          id: index,
          fullName: `large/repository-${index}`,
          name: `repository-${index}`,
          language: ["TypeScript", "Python", "Go", "Rust"][index % 4],
        }),
      ),
    );
    const coordinates = new Set(
      city.map((building) => building.position.join(",")),
    );

    expect(city).toHaveLength(1_000);
    expect(coordinates.size).toBe(1_000);
    expect(
      city.every((building) =>
        building.position.every((coordinate) => Number.isFinite(coordinate)),
      ),
    ).toBe(true);
  });

  it("packs neighboring buildings into dense city blocks", () => {
    const [first, second] = buildCity([
      repo({ id: 1, fullName: "dense/a", name: "a" }),
      repo({ id: 2, fullName: "dense/b", name: "b" }),
    ]);
    const distance = Math.hypot(
      first.position[0] - second.position[0],
      first.position[2] - second.position[2],
    );

    expect(distance).toBeLessThan(4);
    expect(distance).toBeGreaterThan(3.1);
  });

  it("interlaces organic color neighborhoods without creating skyline domes", () => {
    const city = buildCity(
      Array.from({ length: 144 }, (_, index) =>
        repo({
          id: index,
          fullName: `radial/repository-${index}`,
          name: `repository-${index}`,
          language: ["TypeScript", "Python", "Go", "Rust"][index % 4],
          commits30d: 144 - index,
        }),
      ),
    );
    const districtCenters = new Map<string, { x: number; z: number }>();
    ["TypeScript", "Python", "Go", "Rust"].forEach((language) => {
      const district = city.filter((building) => building.language === language);
      districtCenters.set(language, {
        x:
          district.reduce(
            (total, building) => total + building.position[0],
            0,
          ) / district.length,
        z:
          district.reduce(
            (total, building) => total + building.position[2],
            0,
          ) / district.length,
      });

      const byActivity = [...district].sort(
        (a, b) => b.activityScore - a.activityScore,
      );
      const tallX = byActivity.slice(0, 9).map((building) => building.position[0]);
      const tallZ = byActivity.slice(0, 9).map((building) => building.position[2]);
      const tallSpan = Math.hypot(
        Math.max(...tallX) - Math.min(...tallX),
        Math.max(...tallZ) - Math.min(...tallZ),
      );
      expect(tallSpan).toBeGreaterThan(12);
    });

    const centers = [...districtCenters.values()];
    const closestCenters = Math.min(
      ...centers.flatMap((first, firstIndex) =>
        centers
          .slice(firstIndex + 1)
          .map((second) => Math.hypot(first.x - second.x, first.z - second.z)),
      ),
    );
    const boundaryBuildings = city.filter((building) =>
      city.some(
        (neighbor) =>
          neighbor.language !== building.language &&
          Math.hypot(
            neighbor.position[0] - building.position[0],
            neighbor.position[2] - building.position[2],
          ) < 5.4,
      ),
    );

    expect(closestCenters).toBeLessThan(18);
    expect(boundaryBuildings.length).toBeGreaterThan(city.length * 0.2);
  });

  it("uses core colors for common languages and gray for uncommon ones", () => {
    expect(languageColor("TypeScript")).toBe("#3178c6");
    expect(languageColor("Python")).toBe("#3572a5");
    expect(languageColor("UncommonLang")).toBe(languageColor("Other"));
    expect(languageColor("UncommonLang")).toBe("#7b858f");
  });

  it("uses stars, contributors, and activity as separate window signals", () => {
    const starCity = buildCity([
      repo({
        id: 1,
        fullName: "signals/low-stars",
        stars: 0,
        commits30d: 0,
        mergedPullRequests30d: 0,
        closedIssues30d: 0,
        openedIssues30d: 0,
      }),
      repo({
        id: 2,
        fullName: "signals/high-stars",
        stars: 100_000,
        commits30d: 0,
        mergedPullRequests30d: 0,
        closedIssues30d: 0,
        openedIssues30d: 0,
      }),
    ]);
    expect(starCity[1].windowRows).toBeGreaterThan(starCity[0].windowRows);
    expect(starCity[0].windowRows).toBe(3);
    expect(starCity[1].windowRows).toBe(4);
    expect(starCity.every((building) => building.windowCount % 3 === 0)).toBe(
      true,
    );

    const contributorCity = buildCity([
      repo({
        id: 3,
        fullName: "signals/few-people",
        contributorCount: 0,
      }),
      repo({
        id: 4,
        fullName: "signals/many-people",
        contributorCount: 1_000,
      }),
    ]);
    expect(contributorCity[1].brightness).toBeGreaterThan(
      contributorCity[0].brightness,
    );

    const activityCity = buildCity([
      repo({
        id: 5,
        fullName: "signals/inactive",
        commits30d: 0,
        mergedPullRequests30d: 0,
        closedIssues30d: 0,
        openedIssues30d: 0,
      }),
      repo({
        id: 6,
        fullName: "signals/busy",
        commits30d: 200,
      }),
    ]);
    expect(activityCity[0].windowRows).toBeGreaterThanOrEqual(3);
    expect(activityCity[0].illumination).toBe(0);
    expect(activityCity[1].illumination).toBeGreaterThan(
      activityCity[0].illumination,
    );
  });

  it("turns recent pushes into beacon intensity and disables archived beacons", () => {
    const referenceTime = Date.parse("2026-07-27T00:00:00Z");
    const city = buildCity(
      [
        repo({
          id: 1,
          fullName: "signals/recent",
          pushedAt: "2026-07-26T00:00:00Z",
        }),
        repo({
          id: 2,
          fullName: "signals/stale",
          pushedAt: "2026-05-01T00:00:00Z",
        }),
        repo({
          id: 3,
          fullName: "signals/archived",
          pushedAt: "2026-07-27T00:00:00Z",
          archived: true,
        }),
      ],
      referenceTime,
    );

    expect(city[0].recentActivity).toBeGreaterThan(0.9);
    expect(city[1].recentActivity).toBe(0);
    expect(city[2].recentActivity).toBe(0);
  });

  it("uses repository size for footprint and darkens archived repositories", () => {
    const city = buildCity([
      repo({ id: 1, fullName: "signals/small", sizeKb: 10 }),
      repo({ id: 2, fullName: "signals/large", sizeKb: 1_000_000 }),
      repo({
        id: 3,
        fullName: "signals/archived",
        archived: true,
        sizeKb: 10_000,
      }),
    ]);

    expect(city[1].width).toBeGreaterThan(city[0].width);
    expect(city[1].depth).toBeGreaterThan(city[0].depth);
    expect(city[2].brightness).toBe(0);
    expect(city[2].illumination).toBe(0);
    expect(city[2].windowCount).toBeGreaterThan(0);
    expect(city[2].height).toBe(1.4);
  });
});
