import { describe, expect, it } from "vitest";
import { featuredOrganizations, featuredRepositories } from "./discovery";

const OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const REPOSITORY_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[a-z\d._-]{1,100}$/i;

describe("discovery catalog", () => {
  it("uses unique, valid organization owners", () => {
    const owners = featuredOrganizations.map((item) => item.owner);
    expect(new Set(owners).size).toBe(owners.length);
    expect(owners.every((owner) => OWNER_PATTERN.test(owner))).toBe(true);
  });

  it("uses unique, valid repository names", () => {
    const repositories = featuredRepositories.map((item) => item.fullName);
    expect(new Set(repositories).size).toBe(repositories.length);
    expect(repositories.every((repo) => REPOSITORY_PATTERN.test(repo))).toBe(true);
  });
});
