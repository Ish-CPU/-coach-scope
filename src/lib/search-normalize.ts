/**
 * Athlete-friendly search normalization, alias expansion, and scoring.
 *
 * The existing `runSearch` does Prisma `contains` against the literal query.
 * That's strict: "bama" finds nothing, "u of m" finds nothing, "georgia"
 * misses "University of Georgia" because of word order. This module gives
 * `runSearch` three knobs:
 *
 *   1. normalizeSearchText(q)        — lowercase, strip punctuation, collapse
 *                                      whitespace; drop "the/of/at/&" filler
 *                                      so positional differences don't matter.
 *   2. expandSchoolAliases(q)        — turn "uga" / "bama" / "msu" into the
 *                                      official school names so we get the
 *                                      same results athletes would expect.
 *   3. scoreSearchHit(query, hit)    — relevance score with the priority order
 *                                      asked for: alias > exact > startsWith
 *                                      > contains > token > coach > meta.
 *
 * Helpers stay pure + deterministic so they're trivial to unit-test.
 */

// Words we drop from both the query and indexed strings when comparing.
// Keeps "Texas A&M" and "Texas A and M" matching; keeps "University of
// Texas at Austin" matching "texas austin". We do *not* drop "state" — that
// distinguishes "Texas" from "Texas State".
const FILLER_WORDS: ReadonlySet<string> = new Set([
  "the",
  "of",
  "at",
  "and",
  "&",
]);

/**
 * Lowercase + strip punctuation + collapse whitespace + drop filler.
 *
 *   "University of Texas at Austin" → "university texas austin"
 *   "Texas A&M"                     → "texas am"
 *   "Saint John's"                  → "saint johns"
 *   "Mt. San Antonio College"       → "mt san antonio college"
 *   "mt.sac" / "mt-sac" / "mt sac"  → "mt sac"   (periods become spaces)
 *   "mtsac"                          → "mtsac"   (no separator → one token)
 */
export function normalizeSearchText(s: string | null | undefined): string {
  if (!s) return "";
  const cleaned = s
    .normalize("NFKC")
    .toLowerCase()
    // Apostrophes glued to letters first (don't leave a stray space).
    .replace(/[’'`]/g, "")
    // Everything else non-alphanumeric becomes a space.
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !FILLER_WORDS.has(tok))
    .join(" ");
}

/** Same as normalizeSearchText but returns the token array. */
export function searchTokens(s: string | null | undefined): string[] {
  const n = normalizeSearchText(s);
  return n ? n.split(" ") : [];
}

// ---------------------------------------------------------------------------
// Alias map
// ---------------------------------------------------------------------------
//
// Each alias key is a *normalized* search string (post `normalizeSearchText`).
// The value is the list of official `University.name` strings to OR into the
// Prisma WHERE clause. Multi-target aliases ("msu", "miami") are intentional —
// we'd rather show both Michigan State and Mississippi State than guess wrong.

const ALIAS_MAP: Record<string, string[]> = {
  // Football powerhouses
  bama: ["University of Alabama"],
  alabama: ["University of Alabama"],
  "roll tide": ["University of Alabama"],
  uga: ["University of Georgia"],
  georgia: ["University of Georgia"],
  texas: ["University of Texas at Austin", "University of Texas"],
  ut: ["University of Texas at Austin", "University of Texas", "University of Tennessee"],
  "texas am": ["Texas A&M University"],
  tamu: ["Texas A&M University"],
  "texas a m": ["Texas A&M University"],
  usc: ["University of Southern California"],
  ucla: ["UCLA"],
  "ole miss": ["University of Mississippi"],
  mississippi: ["University of Mississippi", "Mississippi State University"],
  msu: ["Michigan State University", "Mississippi State University"],
  lsu: ["Louisiana State University"],
  fsu: ["Florida State University"],
  miami: ["University of Miami", "Miami University"],
  ucf: ["University of Central Florida"],
  usf: ["University of South Florida"],
  smu: ["Southern Methodist University"],
  byu: ["Brigham Young University"],
  wvu: ["West Virginia University"],
  ecu: ["East Carolina University"],
  fau: ["Florida Atlantic University"],
  uab: ["University of Alabama at Birmingham"],
  utsa: ["University of Texas at San Antonio"],
  unlv: ["University of Nevada Las Vegas"],
  niu: ["Northern Illinois University"],
  // Big Ten / common shorthand
  osu: ["Ohio State University", "Oklahoma State University", "Oregon State University"],
  "ohio state": ["Ohio State University"],
  "penn state": ["Penn State University"],
  michigan: ["University of Michigan", "Michigan State University"],
  minnesota: ["University of Minnesota"],
  nebraska: ["University of Nebraska"],
  iowa: ["University of Iowa", "Iowa State University"],
  "iowa state": ["Iowa State University"],
  illinois: ["University of Illinois", "Illinois State University"],
  // ACC / SEC / Big 12 short forms
  pitt: ["University of Pittsburgh"],
  cuse: ["Syracuse University"],
  bc: ["Boston College"],
  duke: ["Duke University"],
  unc: ["University of North Carolina at Chapel Hill"],
  "north carolina": ["University of North Carolina at Chapel Hill", "North Carolina State University"],
  "nc state": ["North Carolina State University"],
  ncsu: ["North Carolina State University"],
  clemson: ["Clemson University"],
  louisville: ["University of Louisville"],
  kentucky: ["University of Kentucky"],
  uk: ["University of Kentucky"],
  arkansas: ["University of Arkansas"],
  tennessee: ["University of Tennessee"],
  vols: ["University of Tennessee"],
  vandy: ["Vanderbilt University"],
  vanderbilt: ["Vanderbilt University"],
  auburn: ["Auburn University"],
  florida: ["University of Florida"],
  uf: ["University of Florida"],
  "south carolina": ["University of South Carolina", "South Carolina State University"],
  notre: ["University of Notre Dame"],
  "notre dame": ["University of Notre Dame"],
  oklahoma: ["University of Oklahoma"],
  ou: ["University of Oklahoma"],
  oklahomastate: ["Oklahoma State University"],
  baylor: ["Baylor University"],
  "texas tech": ["Texas Tech University"],
  "kansas state": ["Kansas State University"],
  ksu: ["Kansas State University", "Kennesaw State University"],
  kansas: ["University of Kansas"],
  ku: ["University of Kansas"],
  houston: ["University of Houston", "Houston Christian University"],
  cincinnati: ["University of Cincinnati"],
  arizona: ["University of Arizona", "Arizona State University"],
  "arizona state": ["Arizona State University"],
  asu: ["Arizona State University", "Alabama State University", "Appalachian State University"],
  utah: ["University of Utah"],
  colorado: ["University of Colorado"],
  // Pac / Big Ten west moves
  oregon: ["University of Oregon"],
  washington: ["University of Washington"],
  stanford: ["Stanford University"],
  // Common HBCU shorthand
  jsu: ["Jackson State University", "Jacksonville State University"],
  famu: ["Florida A&M University"],
  // Service academies
  navy: ["United States Naval Academy"],
  army: ["United States Military Academy"],
  "air force": ["United States Air Force Academy"],
  usafa: ["United States Air Force Academy"],
  // Mid-majors / G5
  memphis: ["University of Memphis"],
  tulane: ["Tulane University"],
  tulsa: ["University of Tulsa"],
  temple: ["Temple University"],
  rice: ["Rice University"],
  hawaii: ["University of Hawaii at Manoa"],
  wyoming: ["University of Wyoming"],
  "utah state": ["Utah State University"],
  nevada: ["University of Nevada Reno", "University of Nevada Las Vegas"],
  reno: ["University of Nevada Reno"],
  "san diego state": ["San Diego State University"],
  sdsu: ["San Diego State University", "South Dakota State University"],
  // Misc Big East / A10
  uconn: ["University of Connecticut"],
  villanova: ["Villanova University"],
  georgetown: ["Georgetown University"],
  dayton: ["University of Dayton"],
  drake: ["Drake University"],
  // FCS frequent fliers
  ndsu: ["North Dakota State University"],
  und: ["University of North Dakota"],
  usd: ["University of South Dakota"],
  uni: ["University of Northern Iowa"],
  mtsu: ["Middle Tennessee State University"],
  "old miss": ["University of Mississippi"],
  odu: ["Old Dominion University"],
  jmu: ["James Madison University"],
  appstate: ["Appalachian State University"],
  "app state": ["Appalachian State University"],
  // JUCO / CCCAA — Mt. San Antonio College.
  // Keys are stored in their *normalized* form (post normalizeSearchText).
  // "mt.sac" / "mt-sac" / "mt sac" all normalize to "mt sac" → one key.
  // "mtsac" (no separator) collapses to a single token → a separate key.
  "mt sac": ["Mt. San Antonio College"],
  mtsac: ["Mt. San Antonio College"],
  "mount sac": ["Mt. San Antonio College"],
  "mount san antonio": ["Mt. San Antonio College"],
  "mount san antonio college": ["Mt. San Antonio College"],
  "san antonio college": ["Mt. San Antonio College"],
};

/**
 * Expand a normalized query into the list of canonical University names that
 * alias to it. Returns an empty array when there's no alias match.
 *
 * Matches both the whole-query and any single-token interpretation, so
 * "uga football" still resolves to the Georgia row.
 */
export function expandSchoolAliases(rawQuery: string | null | undefined): string[] {
  const normalized = normalizeSearchText(rawQuery);
  if (!normalized) return [];

  const matches = new Set<string>();

  // Exact whole-query alias match.
  if (ALIAS_MAP[normalized]) {
    for (const name of ALIAS_MAP[normalized]) matches.add(name);
  }

  // Token-boundary phrase match only.
  // Prevents bad matches like "mount" containing "ou".
  const padded = ` ${normalized} `;

  for (const key of Object.keys(ALIAS_MAP)) {
    if (key === normalized) continue;

    // Require aliases to be at least 3 chars for partial phrase matching.
    // This avoids short aliases like "ou", "ut", "bc" matching inside words.
    if (key.length < 3) continue;

    const paddedKey = ` ${key} `;

    if (padded.includes(paddedKey)) {
      for (const name of ALIAS_MAP[key]) matches.add(name);
    }
  }

  return [...matches];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * The shape `runSearch` knows how to feed us. We accept the union so the
 * scorer is reusable across coach / university / dorm / school hits.
 */
export interface ScorableHit {
  type: "coach" | "university" | "dorm" | "school";
  title: string;
  subtitle?: string;
  /** Optional canonical university name backing this hit (for alias scoring). */
  universityName?: string;
}

const SCORE = {
  ALIAS_EXACT: 100,
  NAME_EXACT: 80,
  STARTS_WITH: 60,
  CONTAINS: 40,
  TOKEN_MATCH: 20,
  COACH_MATCH: 35,
  META_MATCH: 10,
  TYPE_PENALTY_DORM: -2,
  TYPE_PENALTY_SCHOOL: -1,
} as const;

/**
 * Score a single search hit against a user query. Higher = more relevant.
 * Designed to be cheap (no allocations beyond the token splits).
 */
export function scoreSearchHit(query: string, hit: ScorableHit): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;
  const title = normalizeSearchText(hit.title);
  const subtitle = normalizeSearchText(hit.subtitle ?? "");
  const uname = normalizeSearchText(hit.universityName ?? "");

  const aliases = new Set(expandSchoolAliases(query).map(normalizeSearchText));

  let score = 0;

  // 1. Alias match — strongest signal: the user typed "uga" and this hit is
  // backed by "University of Georgia".
  if (uname && aliases.has(uname)) score += SCORE.ALIAS_EXACT;
  if (title && aliases.has(title)) score += SCORE.ALIAS_EXACT;

  // 2. Exact / startsWith / contains against the hit's title.
  if (title === q) score += SCORE.NAME_EXACT;
  else if (title.startsWith(q)) score += SCORE.STARTS_WITH;
  else if (title.includes(q)) score += SCORE.CONTAINS;

  // 3. Token coverage — "georgia football" should still score the Georgia
  // football coach card even though the title is "Kirby Smart".
  const qTokens = q.split(" ").filter(Boolean);
  if (qTokens.length > 0) {
    const haystack = `${title} ${subtitle} ${uname}`.trim();
    let hits = 0;
    for (const t of qTokens) {
      if (t.length < 2) continue;
      if (haystack.includes(t)) hits++;
    }
    if (hits > 0) {
      // Proportional credit so "uconn baseball" scores 2/2 higher than 1/2.
      score += Math.round((SCORE.TOKEN_MATCH * hits) / qTokens.length);
    }
  }

  // 4. Coach-card bonus when the user typed a name and the coach name matches.
  if (hit.type === "coach" && title.includes(q)) {
    score += SCORE.COACH_MATCH;
  }

  // 5. Subtitle (city/state/conference/sport) match.
  if (subtitle && subtitle.includes(q)) score += SCORE.META_MATCH;

  // 6. Mild de-prioritization so universities float above dorms/schools when
  // everything else is equal.
  if (hit.type === "dorm") score += SCORE.TYPE_PENALTY_DORM;
  if (hit.type === "school") score += SCORE.TYPE_PENALTY_SCHOOL;

  return score;
}

/**
 * Build a list of OR-clauses for Prisma matching on university name.
 * Used by `runSearch` to widen the WHERE without rewriting it from scratch.
 *
 * Each clause is a `{ contains: <substring>, mode: "insensitive" }` shape so
 * the caller can drop them straight into a Prisma `OR: [...]` array.
 */
export function buildNameLikeClauses(query: string): { contains: string; mode: "insensitive" }[] {
  const out: { contains: string; mode: "insensitive" }[] = [];
  const seen = new Set<string>();

  function push(s: string | null | undefined) {
    if (!s) return;
    const t = s.trim();
    if (t.length < 2) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ contains: t, mode: "insensitive" });
  }

  push(query);

  // Each alias target widens the search to the official name.
  for (const expanded of expandSchoolAliases(query)) push(expanded);

  // Individual tokens — "north carolina" should also match by "carolina".
  for (const tok of searchTokens(query)) {
    if (tok.length >= 4) push(tok);
  }

  return out;
}
