/**
 * MyUniversityVerified's user-facing rating filter options.
 * Single source of truth — used by search, coach, university, dorm, and
 * program review filters.
 *
 * "Any Rating" is represented as `value: null` and is the default — any
 * page that reads `?minRating=` should treat a missing/0 value as "any".
 */
export interface RatingFilterOption {
  /** Numeric threshold; null means no filter. */
  value: number | null;
  /** URL-safe representation; "" for "any". */
  param: string;
  /** Human label used in pills. */
  label: string;
}

export const RATING_FILTER_OPTIONS: RatingFilterOption[] = [
  { value: null, param: "", label: "Any Rating" },
  { value: 1, param: "1", label: "1+ Stars" },
  { value: 2, param: "2", label: "2+ Stars" },
  { value: 3, param: "3", label: "3+ Stars" },
  { value: 4, param: "4", label: "4+ Stars" },
  { value: 4.5, param: "4.5", label: "4.5+ Stars" },
];

/** Parse a raw query-param value into a usable threshold (or null for "any"). */
export function parseMinRating(raw: string | string[] | null | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Snap to one of our supported thresholds; reject anything else.
  return RATING_FILTER_OPTIONS.find((o) => o.value === n)?.value ?? null;
}

/** Filter helper for in-memory review arrays (used on profile pages). */
export function filterByMinRating<T extends { overall: number }>(
  items: T[],
  min: number | null
): T[] {
  if (min === null || min <= 0) return items;
  return items.filter((r) => r.overall >= min);
}
