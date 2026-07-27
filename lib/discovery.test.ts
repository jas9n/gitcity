import { describe, expect, it } from "vitest";
import {
  featuredOrganizations,
  isCachedExploreTarget,
} from "./discovery";

const OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

describe("discovery catalog", () => {
  it("uses unique, valid organization owners", () => {
    const owners = featuredOrganizations.map((item) => item.owner);
    expect(new Set(owners).size).toBe(owners.length);
    expect(owners.every((owner) => OWNER_PATTERN.test(owner))).toBe(true);
    expect(owners.length).toBeGreaterThanOrEqual(16);
  });

  it("marks every Explore option for durable caching", () => {
    expect(
      featuredOrganizations.every((item) =>
        isCachedExploreTarget(item.owner),
      ),
    ).toBe(true);
    expect(isCachedExploreTarget("unlisted-owner")).toBe(false);
  });
});
