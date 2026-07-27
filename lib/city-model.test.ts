import { describe, expect, it } from "vitest";
import {
  activityScore,
  buildCity,
  hashString,
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
});
