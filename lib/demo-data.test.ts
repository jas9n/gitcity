import { describe, expect, it } from "vitest";
import { demoRepositories } from "./demo-data";

describe("demo city cache", () => {
  it("ships as an immutable offline snapshot", () => {
    expect(demoRepositories.length).toBeGreaterThan(0);
    expect(Object.isFrozen(demoRepositories)).toBe(true);
    expect(demoRepositories.every((repo) => Object.isFrozen(repo))).toBe(true);
    expect(demoRepositories.every((repo) => repo.metricsEstimated === false)).toBe(
      true,
    );
  });
});
