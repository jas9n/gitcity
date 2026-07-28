const FULL_WINDOW_ROWS = 32;
const LARGE_CITY_WINDOW_ROWS = 24;
const VERY_LARGE_CITY_WINDOW_ROWS = 18;

export function visibleWindowRowCount(
  windowRows: number,
  buildingCount: number,
): number {
  const cap =
    buildingCount > 900
      ? VERY_LARGE_CITY_WINDOW_ROWS
      : buildingCount > 550
        ? LARGE_CITY_WINDOW_ROWS
        : FULL_WINDOW_ROWS;
  return Math.min(windowRows, cap);
}

export function cityPixelRatio(buildingCount: number): [number, number] {
  if (buildingCount > 900) return [0.9, 1.15];
  if (buildingCount > 550) return [1, 1.35];
  return [1, 1.7];
}
