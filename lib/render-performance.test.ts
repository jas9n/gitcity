import { describe, expect, it } from "vitest";
import {
  cityPixelRatio,
  visibleWindowRowCount,
} from "./render-performance";

describe("large-city rendering policy", () => {
  it("keeps the complete visual density for normal cities", () => {
    expect(visibleWindowRowCount(32, 550)).toBe(32);
    expect(visibleWindowRowCount(12, 550)).toBe(12);
    expect(cityPixelRatio(550)).toEqual([1, 1.7]);
  });

  it("caps only large-city window density while preserving existing rows", () => {
    expect(visibleWindowRowCount(32, 551)).toBe(24);
    expect(visibleWindowRowCount(20, 551)).toBe(20);
    expect(visibleWindowRowCount(32, 901)).toBe(18);
    expect(visibleWindowRowCount(14, 901)).toBe(14);
    expect(cityPixelRatio(551)).toEqual([1, 1.35]);
    expect(cityPixelRatio(901)).toEqual([0.9, 1.15]);
  });
});
