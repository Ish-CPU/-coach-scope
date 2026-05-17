import { Division } from "@prisma/client";

/**
 * University Verified's user-facing division (level) taxonomy.
 *
 * The Prisma `Division` enum stores stable short codes (`D1`, `D2`, `D3`,
 * `NJCAA`, `NAIA`, `OTHER`) — those go in the URL and the database.
 * The labels here are what the user actually sees in filter pills.
 *
 * Single source of truth: changing this list updates the search filter
 * UI everywhere (no more raw "D1" / "NJCAA" strings rendered to humans).
 */
export interface DivisionOption {
  value: Division;
  label: string;
}

export const DIVISION_OPTIONS: DivisionOption[] = [
  { value: Division.D1, label: "NCAA Division I" },
  { value: Division.D2, label: "NCAA Division II" },
  { value: Division.D3, label: "NCAA Division III" },
  { value: Division.NJCAA, label: "JUCO" },
  { value: Division.NAIA, label: "NAIA" },
];

const DIVISION_VALUES: ReadonlySet<string> = new Set(DIVISION_OPTIONS.map((d) => d.value));

const ALIASES: Record<string, Division> = {
  // Short codes — what the URL uses.
  d1: Division.D1,
  d2: Division.D2,
  d3: Division.D3,
  njcaa: Division.NJCAA,
  naia: Division.NAIA,
  // Friendly labels users (or links from elsewhere) might pass.
  "ncaa division i": Division.D1,
  "ncaa division ii": Division.D2,
  "ncaa division iii": Division.D3,
  "ncaa d1": Division.D1,
  "ncaa d2": Division.D2,
  "ncaa d3": Division.D3,
  juco: Division.NJCAA,
  "junior college": Division.NJCAA,
  "community college": Division.NJCAA,
  "national association of intercollegiate athletics": Division.NAIA,
};

/**
 * Coerce a raw URL value (or label, or alias) into the canonical Division
 * enum. Returns null when the value isn't one of our supported levels —
 * which is what callers should treat as "no division filter."
 */
export function parseDivision(raw: string | string[] | null | undefined): Division | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  // Fast path: exact enum value.
  if (DIVISION_VALUES.has(v)) return v as Division;
  // Slow path: case-insensitive alias.
  return ALIASES[v.trim().toLowerCase()] ?? null;
}

export function divisionLabel(value: Division | null | undefined): string {
  if (!value) return "";
  return DIVISION_OPTIONS.find((d) => d.value === value)?.label ?? value;
}
