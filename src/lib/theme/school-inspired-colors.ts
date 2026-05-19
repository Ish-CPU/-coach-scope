// ---------------------------------------------------------------------------
// School-inspired color palette
// ---------------------------------------------------------------------------
//
// PURPOSE
// Map a university name → a palette that's *recognizably* aligned with the
// school's identity, while NOT replicating the institution's official brand
// guide. The product brief is explicit: users should instantly feel "yes,
// this matches", but the platform must keep its own visual identity and
// not appear officially affiliated.
//
// LEGAL / BRANDING RULES (mirror src/components/SiteFooter.tsx)
//   - Never use an official logo, mascot, athletics mark, or wordmark.
//   - Do not paste exact published brand hex codes. Every entry below
//     is intentionally OFFSET from the school's known brand color by a
//     few HSL points — close enough for instant recognition, distinct
//     enough that it can't be claimed as a verbatim copy of the brand
//     guide.
//   - When in doubt, lean *softer* and slightly desaturated. The platform
//     surface (cards, whitespace, typography) does most of the visual
//     work; the school color is a recognition cue, not the dominant ink.
//
// COVERAGE
// This is NOT a complete coverage of every US institution. It's a curated
// starter set of ~25 well-known schools. Anything not in the table falls
// back through getUniversityTheme() to the platform default. Adding a new
// school is one entry; no rebuild required outside of restart.
//
// MAINTENANCE
// Keys are lower-cased university names exactly as stored in the
// University.name column. If a name in the DB differs (extra suffix,
// abbreviated form), add both keys pointing at the same value rather
// than playing fuzzy-match games in the resolver.

export interface InspiredPalette {
  primary: string;
  secondary: string;
  /** Optional — falls back to `secondary` if not provided. */
  accent?: string;
}

/**
 * Reference table. Hex values below are platform-curated *adjustments* of
 * well-known school identities. They are not lifts from any school's
 * published brand guide; they are deliberately shifted in hue and/or
 * saturation so the platform retains its own visual fingerprint.
 */
export const INSPIRED_COLORS: Record<string, InspiredPalette> = {
  // SEC + nearby
  "university of alabama":            { primary: "#A82142", secondary: "#1F1F1F", accent: "#E2CFD2" },
  "auburn university":                { primary: "#0E1F4A", secondary: "#E27E2A", accent: "#F2D7B5" },
  "university of georgia":            { primary: "#A8232C", secondary: "#0E1A33", accent: "#E7E2D2" },
  "university of florida":            { primary: "#0E3B7F", secondary: "#E27425", accent: "#F2D7B5" },
  "university of tennessee":          { primary: "#E0822C", secondary: "#1B1B1B", accent: "#F4D7B6" },
  "louisiana state university":       { primary: "#3E2A6B", secondary: "#D6B14A", accent: "#F0E2A8" },
  "university of kentucky":           { primary: "#1F4FA8", secondary: "#0F1727", accent: "#CFD8E8" },
  "university of arkansas":           { primary: "#A5223A", secondary: "#1B1B1B", accent: "#E8CFD3" },
  "university of mississippi":        { primary: "#0F2A5E", secondary: "#B62A3A", accent: "#E8CFD3" },

  // Big Ten + Midwest
  "ohio state university":            { primary: "#C0252A", secondary: "#3B3F45", accent: "#E8D6D7" },
  "the ohio state university":        { primary: "#C0252A", secondary: "#3B3F45", accent: "#E8D6D7" },
  "university of michigan":           { primary: "#0E2A47", secondary: "#D7B048", accent: "#F0E2A8" },
  "michigan state university":        { primary: "#125F38", secondary: "#E8E8E8", accent: "#CDE3D6" },
  "pennsylvania state university":    { primary: "#0F2A5E", secondary: "#E8E8E8", accent: "#CFD8E8" },
  "penn state":                       { primary: "#0F2A5E", secondary: "#E8E8E8", accent: "#CFD8E8" },
  "university of wisconsin":          { primary: "#A52132", secondary: "#1B1B1B", accent: "#E8CFD3" },
  "university of nebraska":           { primary: "#C72734", secondary: "#1B1B1B", accent: "#E8CFD3" },
  "indiana university":               { primary: "#7A1F2A", secondary: "#E8E8E8", accent: "#E8D6D7" },

  // Big 12 + Texas
  "university of texas":              { primary: "#C66426", secondary: "#1A1A1A", accent: "#F2D7B5" },
  "university of texas at austin":    { primary: "#C66426", secondary: "#1A1A1A", accent: "#F2D7B5" },
  "texas a&m university":             { primary: "#5C0E1F", secondary: "#E8E8E8", accent: "#E8CFD3" },
  "oklahoma state university":        { primary: "#D45F25", secondary: "#1A1A1A", accent: "#F2D7B5" },
  "university of oklahoma":           { primary: "#7E1B2D", secondary: "#E8DCBA", accent: "#F0E2A8" },
  "baylor university":                { primary: "#1B3F26", secondary: "#D7B048", accent: "#F0E2A8" },

  // ACC
  "duke university":                  { primary: "#1F2F8F", secondary: "#1A1A1A", accent: "#CFD8E8" },
  "university of north carolina":     { primary: "#5BA0D8", secondary: "#0F1727", accent: "#CFE2F0" },
  "university of north carolina at chapel hill": { primary: "#5BA0D8", secondary: "#0F1727", accent: "#CFE2F0" },
  "north carolina state university":  { primary: "#C0252A", secondary: "#1F1F1F", accent: "#E8D6D7" },
  "clemson university":               { primary: "#D45F25", secondary: "#3A2D5C", accent: "#F2D7B5" },
  "florida state university":         { primary: "#6A1F2A", secondary: "#D7B048", accent: "#F0E2A8" },
  "university of miami":              { primary: "#0E5C3C", secondary: "#D7822C", accent: "#F2D7B5" },
  "university of virginia":           { primary: "#23375C", secondary: "#D7B048", accent: "#F0E2A8" },
  "virginia tech":                    { primary: "#6A1F2A", secondary: "#D45F25", accent: "#F2D7B5" },

  // Pac-12 + west coast
  "stanford university":              { primary: "#8A1E22", secondary: "#1B1B1B", accent: "#E8CFD3" },
  "university of southern california": { primary: "#9A1B30", secondary: "#D7B048", accent: "#F0E2A8" },
  "ucla":                             { primary: "#3179B0", secondary: "#E5B23A", accent: "#F0E2A8" },
  "university of california, los angeles": { primary: "#3179B0", secondary: "#E5B23A", accent: "#F0E2A8" },
  "university of oregon":             { primary: "#0F4F33", secondary: "#E5C432", accent: "#F0E2A8" },
  "university of washington":         { primary: "#2D2A6B", secondary: "#D7B048", accent: "#F0E2A8" },
  "arizona state university":         { primary: "#8A1B3F", secondary: "#D7B048", accent: "#F0E2A8" },
  "university of arizona":            { primary: "#7A1B45", secondary: "#0E2A47", accent: "#CFD8E8" },

  // Ivy + Northeast
  "harvard university":               { primary: "#8C1722", secondary: "#1B1B1B", accent: "#E8CFD3" },
  "yale university":                  { primary: "#0E327A", secondary: "#1A1A1A", accent: "#CFD8E8" },
  "princeton university":             { primary: "#D45F25", secondary: "#1A1A1A", accent: "#F2D7B5" },
  "columbia university":              { primary: "#5BA0D8", secondary: "#1A1A1A", accent: "#CFE2F0" },
  "cornell university":               { primary: "#A82142", secondary: "#1A1A1A", accent: "#E8CFD3" },
  "university of pennsylvania":       { primary: "#8A1722", secondary: "#0F2A5E", accent: "#CFD8E8" },
};
