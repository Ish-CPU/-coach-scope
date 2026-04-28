/**
 * Canonical RateMyU sports list.
 *
 * This is the SINGLE source of truth for every dropdown, filter, form,
 * validator, and seed. If you add or remove a sport, do it here.
 *
 * Per spec — only NCAA-level athletics that RateMyU supports today:
 *
 *   Men's:   Football · Basketball · Soccer · Baseball
 *   Women's: Basketball · Softball · Soccer
 *
 * Where both men's and women's variants exist (Basketball, Soccer) the
 * label is gendered. Football, Baseball, and Softball don't have an
 * NCAA cross-gender counterpart at the relevant scale, so they stay bare.
 */

export const SPORTS = [
  "Football",
  "Baseball",
  "Softball",
  "Men's Basketball",
  "Women's Basketball",
  "Men's Soccer",
  "Women's Soccer",
] as const;

export type Sport = (typeof SPORTS)[number];

const SPORT_SET: ReadonlySet<string> = new Set(SPORTS);

/** True when the value is one of our supported sports (case-sensitive). */
export function isAllowedSport(value: string | null | undefined): value is Sport {
  if (!value) return false;
  return SPORT_SET.has(value);
}

/**
 * Coerce free-form sport text to a canonical sport name when possible.
 * Used by the search filters and group-create endpoint to be forgiving
 * about case / pluralization without silently accepting unsupported sports.
 */
export function normalizeSport(value: string | null | undefined): Sport | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  for (const s of SPORTS) {
    if (s.toLowerCase() === lower) return s;
  }
  return null;
}
