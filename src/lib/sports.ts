/**
 * Canonical MyUniversityVerified sports list.
 *
 * This is the SINGLE source of truth for every dropdown, filter, form,
 * validator, and seed. If you add or remove a sport, do it here.
 *
 * The platform supports university athletics globally; the current launch
 * set is the US NCAA-level catalog. International leagues + non-NCAA
 * divisions can extend this list without schema changes.
 *
 *   Men's:   Football · Basketball · Soccer · Baseball
 *   Women's: Basketball · Softball · Soccer
 *
 * Where both men's and women's variants exist (Basketball, Soccer) the
 * label is gendered. Football, Baseball, and Softball don't have a
 * cross-gender counterpart at the relevant US scale, so they stay bare.
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

/**
 * Combines a base sport (e.g. "Basketball") with an optional gender column
 * ("Men's" / "Women's" / "M" / "W" / "Boys" / "Girls") into one of our
 * canonical sport names.
 *
 *   resolveSport("Men's Basketball")            → "Men's Basketball"
 *   resolveSport("Basketball", "Women's")       → "Women's Basketball"
 *   resolveSport("Basketball", "W")             → "Women's Basketball"
 *   resolveSport("Football", "Men's")           → "Football"  (single-gender at NCAA)
 *   resolveSport("Underwater Basket Weaving")   → null
 */
export function resolveSport(
  sport: string | null | undefined,
  gender?: string | null | undefined
): Sport | null {
  // 1. If `sport` already matches a canonical name, accept it directly.
  const direct = normalizeSport(sport);
  if (direct) return direct;
  if (!sport) return null;

  // 2. Try combining gender + sport into a canonical name.
  const base = sport.trim();
  const g = (gender ?? "").trim().toLowerCase();
  const isMens = /^(m|men|men'?s?|male|boys?)$/.test(g);
  const isWomens = /^(w|women|women'?s?|female|girls?)$/.test(g);
  if (isMens) return normalizeSport(`Men's ${base}`);
  if (isWomens) return normalizeSport(`Women's ${base}`);
  return null;
}
