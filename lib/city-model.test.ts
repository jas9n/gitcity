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

  it("uses core colors for common languages and gray for uncommon ones", () => {
    expect(languageColor("TypeScript")).toBe("#3178c6");
    expect(languageColor("Python")).toBe("#3572a5");
    expect(languageColor("UncommonLang")).toBe(languageColor("Other"));
    expect(languageColor("UncommonLang")).toBe("#7b858f");
  });

  it("uses stars for window capacity and contributors for occupancy", () => {
    const starCity = buildCity([
      repo({ id: 1, fullName: "signals/low-stars", stars: 1 }),
      repo({ id: 2, fullName: "signals/high-stars", stars: 100_000 }),
    ]);
    expect(starCity[1].windowCount).toBeGreaterThan(starCity[0].windowCount);

    const contributorCity = buildCity([
      repo({
        id: 3,
        fullName: "signals/few-people",
        contributorCount: 1,
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
    expect(city[2].height).toBe(1.4);
  });
});
