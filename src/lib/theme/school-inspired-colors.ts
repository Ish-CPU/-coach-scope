// ---------------------------------------------------------------------------
// School color palette
// ---------------------------------------------------------------------------
//
// PURPOSE
// Map a university name → the school's recognizable color identity so that
// themed surfaces (hero banners, accent pills, hover states) feel like
// they belong to that school. Colors alone are functional/factual — they
// aren't trademarked the way logos, mascots, and wordmarks are — so we
// can and should use the actual brand colors here for accurate
// recognition. The "inspired-by" offset approach from earlier versions
// was overcautious and was visibly wrong for several schools.
//
// LEGAL RULES (mirror src/components/SiteFooter.tsx)
//   - Never use an official logo, mascot, athletics mark, or wordmark.
//   - Never imply official endorsement / affiliation.
//   - Colors are fine. School color palettes are facts about the school,
//     not protected expression.
//
// COVERAGE
// A curated set of well-known US institutions. Anything not in the table
// falls back through getUniversityTheme() to the platform default. Adding
// a new school is one entry; no rebuild required outside of restart.
//
// MAINTENANCE
// Keys are lower-cased university names exactly as stored in the
// University.name column. If a name in the DB differs (extra suffix,
// abbreviated form), add both keys pointing at the same value rather
// than playing fuzzy-match games in the resolver.
//
// SOURCES
// Hex values pulled from each school's published athletics / brand
// identity page where available. When the brand guide listed multiple
// "approved" variants, we picked the most commonly used primary.

export interface InspiredPalette {
  primary: string;
  secondary: string;
  /** Optional — falls back to `secondary` if not provided. */
  accent?: string;
}

/**
 * Reference table of school primary/secondary brand colors. Use these
 * verbatim — they're the same hex codes the schools publish themselves.
 */
export const INSPIRED_COLORS: Record<string, InspiredPalette> = {
  // SEC + nearby
  "university of alabama":            { primary: "#9E1B32", secondary: "#828A8F", accent: "#F4E6E9" }, // Crimson + Cool Gray
  "auburn university":                { primary: "#03244D", secondary: "#DD550C", accent: "#F7DBC4" }, // Navy + Orange
  "university of georgia":            { primary: "#BA0C2F", secondary: "#000000", accent: "#F4D4DA" }, // Red + Black
  "university of florida":            { primary: "#0021A5", secondary: "#FA4616", accent: "#FBD6C4" }, // Blue + Orange
  "university of tennessee":          { primary: "#FF8200", secondary: "#FFFFFF", accent: "#FFE5C4" }, // Tennessee Orange + White
  "louisiana state university":       { primary: "#461D7C", secondary: "#FDD023", accent: "#FEF1B5" }, // Purple + Gold
  "lsu":                              { primary: "#461D7C", secondary: "#FDD023", accent: "#FEF1B5" },
  "university of kentucky":           { primary: "#0033A0", secondary: "#FFFFFF", accent: "#C4D2EE" }, // Wildcat Blue + White
  "university of arkansas":           { primary: "#9D2235", secondary: "#000000", accent: "#F4D4DA" }, // Cardinal + Black
  "university of mississippi":        { primary: "#14213D", secondary: "#CE1126", accent: "#F4D4DA" }, // Navy + Red
  "ole miss":                         { primary: "#14213D", secondary: "#CE1126", accent: "#F4D4DA" },
  "vanderbilt university":            { primary: "#000000", secondary: "#866D4B", accent: "#E8DECB" }, // Black + Gold
  "university of south carolina":     { primary: "#73000A", secondary: "#000000", accent: "#EFC9CB" }, // Garnet + Black
  "mississippi state university":     { primary: "#660000", secondary: "#FFFFFF", accent: "#E8C4C4" }, // Maroon + White
  "university of missouri":           { primary: "#F1B82D", secondary: "#000000", accent: "#FBEDC4" }, // Mizzou Gold + Black

  // Big Ten + Midwest
  "ohio state university":            { primary: "#BB0000", secondary: "#666666", accent: "#F4D4D4" }, // Scarlet + Gray
  "the ohio state university":        { primary: "#BB0000", secondary: "#666666", accent: "#F4D4D4" },
  "university of michigan":           { primary: "#00274C", secondary: "#FFCB05", accent: "#FEF0B5" }, // Blue + Maize
  "michigan state university":        { primary: "#18453B", secondary: "#FFFFFF", accent: "#C4D8D2" }, // Spartan Green + White
  "pennsylvania state university":    { primary: "#041E42", secondary: "#FFFFFF", accent: "#C4D2EE" }, // Nittany Navy + White
  "penn state":                       { primary: "#041E42", secondary: "#FFFFFF", accent: "#C4D2EE" },
  "university of wisconsin":          { primary: "#C5050C", secondary: "#FFFFFF", accent: "#F4C4C4" }, // Badger Red + White
  "university of nebraska":           { primary: "#E41C38", secondary: "#F5F1E7", accent: "#FBE0E5" }, // Scarlet + Cream
  "indiana university":               { primary: "#990000", secondary: "#EEEDEB", accent: "#F4D4D4" }, // Crimson + Cream
  "purdue university":                { primary: "#CEB888", secondary: "#000000", accent: "#F2E8D2" }, // Old Gold + Black
  "university of illinois":           { primary: "#13294B", secondary: "#E84A27", accent: "#FBD6C4" }, // Illini Blue + Orange
  "university of iowa":               { primary: "#FFCD00", secondary: "#000000", accent: "#FEF0B5" }, // Hawkeye Gold + Black
  "iowa state university":            { primary: "#C8102E", secondary: "#F1BE48", accent: "#FBEDC4" }, // Cardinal + Gold
  "university of minnesota":          { primary: "#7A0019", secondary: "#FFCC33", accent: "#FEF1B5" }, // Maroon + Gold
  "northwestern university":          { primary: "#4E2A84", secondary: "#FFFFFF", accent: "#E0D2EE" }, // Northwestern Purple + White
  "university of notre dame":         { primary: "#0C2340", secondary: "#C99700", accent: "#FBEDC4" }, // Navy Blue + Vegas Gold
  "notre dame":                       { primary: "#0C2340", secondary: "#C99700", accent: "#FBEDC4" },

  // Big 12 + Texas
  "university of texas":              { primary: "#BF5700", secondary: "#FFFFFF", accent: "#FBE0C4" }, // Burnt Orange + White
  "university of texas at austin":    { primary: "#BF5700", secondary: "#FFFFFF", accent: "#FBE0C4" },
  "texas a&m university":             { primary: "#500000", secondary: "#FFFFFF", accent: "#E8C4C4" }, // Maroon + White
  "oklahoma state university":        { primary: "#FA6400", secondary: "#000000", accent: "#FBD6C4" }, // OSU Orange + Black
  "university of oklahoma":           { primary: "#841617", secondary: "#FDF9D8", accent: "#F4D4DA" }, // Crimson + Cream
  "baylor university":                { primary: "#003015", secondary: "#FFB81C", accent: "#FBE5C4" }, // Baylor Green + Gold
  "texas christian university":       { primary: "#4D1979", secondary: "#A3A9AC", accent: "#E0D2EE" }, // Purple + Silver
  "tcu":                              { primary: "#4D1979", secondary: "#A3A9AC", accent: "#E0D2EE" },
  "texas tech university":            { primary: "#CC0000", secondary: "#000000", accent: "#F4D4D4" }, // Scarlet + Black
  "west virginia university":         { primary: "#002855", secondary: "#EAAA00", accent: "#FBEDC4" }, // Old Gold + Blue
  "university of kansas":             { primary: "#0051BA", secondary: "#E8000D", accent: "#C4D2EE" }, // KU Blue + Crimson
  "kansas state university":          { primary: "#512888", secondary: "#FFFFFF", accent: "#E0D2EE" }, // K-State Purple + White

  // ACC
  "duke university":                  { primary: "#001A57", secondary: "#FFFFFF", accent: "#C4D2EE" }, // Duke Blue + White
  "university of north carolina":     { primary: "#7BAFD4", secondary: "#13294B", accent: "#D6E8F2" }, // Carolina Blue + Navy
  "university of north carolina at chapel hill": { primary: "#7BAFD4", secondary: "#13294B", accent: "#D6E8F2" },
  "north carolina state university":  { primary: "#CC0000", secondary: "#000000", accent: "#F4D4D4" }, // Wolfpack Red + Black
  "clemson university":               { primary: "#F66733", secondary: "#522D80", accent: "#FBD6C4" }, // Clemson Orange + Regalia
  "florida state university":         { primary: "#782F40", secondary: "#CEB888", accent: "#F2E8D2" }, // Garnet + Gold
  "university of miami":              { primary: "#005030", secondary: "#F47321", accent: "#FBD6C4" }, // Miami Green + Orange
  "university of virginia":           { primary: "#232D4B", secondary: "#E57200", accent: "#FBE0C4" }, // Jefferson Blue + Cavalier Orange
  "virginia tech":                    { primary: "#630031", secondary: "#CF4420", accent: "#F4D4DA" }, // Hokie Maroon + Burnt Orange
  "boston college":                   { primary: "#8A100B", secondary: "#BC9B6A", accent: "#F4D4D4" }, // Maroon + Gold
  "syracuse university":              { primary: "#F76900", secondary: "#000E54", accent: "#FBD6C4" }, // Syracuse Orange + Navy
  "wake forest university":           { primary: "#9E7E38", secondary: "#000000", accent: "#F2E8D2" }, // Old Gold + Black
  "university of louisville":         { primary: "#AD0000", secondary: "#000000", accent: "#F4D4D4" }, // Cardinal Red + Black
  "university of pittsburgh":         { primary: "#003594", secondary: "#FFB81C", accent: "#C4D2EE" }, // Royal + Gold

  // Pac-12 + west coast
  "stanford university":              { primary: "#8C1515", secondary: "#FFFFFF", accent: "#F4D4D4" }, // Cardinal Red + White
  "university of southern california": { primary: "#990000", secondary: "#FFC72C", accent: "#FEF0B5" }, // USC Cardinal + Gold
  "usc":                              { primary: "#990000", secondary: "#FFC72C", accent: "#FEF0B5" },
  "ucla":                             { primary: "#2774AE", secondary: "#FFD100", accent: "#FEF0B5" }, // UCLA Blue + Gold
  "university of california, los angeles": { primary: "#2774AE", secondary: "#FFD100", accent: "#FEF0B5" },
  "university of california los angeles": { primary: "#2774AE", secondary: "#FFD100", accent: "#FEF0B5" },
  "university of california, berkeley": { primary: "#003262", secondary: "#FDB515", accent: "#FBEDC4" }, // Berkeley Blue + Gold
  "uc berkeley":                      { primary: "#003262", secondary: "#FDB515", accent: "#FBEDC4" },
  "university of oregon":             { primary: "#154733", secondary: "#FEE123", accent: "#FEF1B5" }, // Oregon Green + Yellow
  "oregon state university":          { primary: "#DC4405", secondary: "#000000", accent: "#FBD6C4" }, // Beaver Orange + Black
  "university of washington":         { primary: "#4B2E83", secondary: "#B7A57A", accent: "#E0D2EE" }, // Husky Purple + Gold
  "washington state university":      { primary: "#981E32", secondary: "#5E6A71", accent: "#F4D4DA" }, // Crimson + Gray
  "arizona state university":         { primary: "#8C1D40", secondary: "#FFC627", accent: "#FEF1B5" }, // Maroon + Gold
  "university of arizona":            { primary: "#AB0520", secondary: "#0C234B", accent: "#F4D4DA" }, // Arizona Red + Navy
  "university of utah":               { primary: "#CC0000", secondary: "#000000", accent: "#F4D4D4" }, // Utah Red + Black
  "byu":                              { primary: "#002E5D", secondary: "#FFFFFF", accent: "#C4D2EE" }, // BYU Blue + White
  "brigham young university":         { primary: "#002E5D", secondary: "#FFFFFF", accent: "#C4D2EE" },
  "san diego state university":       { primary: "#A6192E", secondary: "#000000", accent: "#F4D4DA" }, // Aztec Red + Black

  // California community colleges + commonly named
  "mt. san antonio college":          { primary: "#003594", secondary: "#FFFFFF", accent: "#C4D2EE" }, // Royal Blue + White
  "mount san antonio college":        { primary: "#003594", secondary: "#FFFFFF", accent: "#C4D2EE" },
  "mt sac":                           { primary: "#003594", secondary: "#FFFFFF", accent: "#C4D2EE" },
  "mt. sac":                          { primary: "#003594", secondary: "#FFFFFF", accent: "#C4D2EE" },
  "saddleback college":               { primary: "#7A0019", secondary: "#FFCC33", accent: "#FEF1B5" }, // Maroon + Gold
  "orange coast college":             { primary: "#003594", secondary: "#FFC72C", accent: "#FEF0B5" }, // Royal Blue + Gold
  "santa monica college":             { primary: "#003594", secondary: "#003594", accent: "#C4D2EE" }, // Corsair Blue
  "fullerton college":                { primary: "#003594", secondary: "#FFFFFF", accent: "#C4D2EE" }, // Hornet Blue + White

  // Ivy + Northeast
  "harvard university":               { primary: "#A51C30", secondary: "#000000", accent: "#F4D4DA" }, // Crimson + Black
  "yale university":                  { primary: "#00356B", secondary: "#FFFFFF", accent: "#C4D2EE" }, // Yale Blue + White
  "princeton university":             { primary: "#E77500", secondary: "#000000", accent: "#FBE0C4" }, // Princeton Orange + Black
  "columbia university":              { primary: "#9BCBEB", secondary: "#000000", accent: "#D6E8F2" }, // Columbia Blue + Black
  "cornell university":               { primary: "#B31B1B", secondary: "#FFFFFF", accent: "#F4D4DA" }, // Carnelian + White
  "university of pennsylvania":       { primary: "#990000", secondary: "#011F5B", accent: "#F4D4D4" }, // Pennsylvania Red + Blue
  "brown university":                 { primary: "#4E3629", secondary: "#ED1C24", accent: "#E8DECB" }, // Brown + Cardinal
  "dartmouth college":                { primary: "#00693E", secondary: "#FFFFFF", accent: "#C4E0D2" }, // Dartmouth Green + White
  "boston university":                { primary: "#CC0000", secondary: "#FFFFFF", accent: "#F4D4D4" }, // BU Scarlet + White
  "rutgers university":               { primary: "#CC0033", secondary: "#000000", accent: "#F4D4DA" }, // Scarlet Knights + Black
  "university of connecticut":        { primary: "#000E2F", secondary: "#FFFFFF", accent: "#C4D2EE" }, // National Flag Blue + White
  "uconn":                            { primary: "#000E2F", secondary: "#FFFFFF", accent: "#C4D2EE" },

  // Service academies + others
  "united states military academy":   { primary: "#000000", secondary: "#D4BF91", accent: "#F2E8D2" }, // Army Black + Gold
  "army":                             { primary: "#000000", secondary: "#D4BF91", accent: "#F2E8D2" },
  "united states naval academy":      { primary: "#00205B", secondary: "#B9975B", accent: "#F2E8D2" }, // Navy Blue + Gold
  "navy":                             { primary: "#00205B", secondary: "#B9975B", accent: "#F2E8D2" },
  "united states air force academy":  { primary: "#003594", secondary: "#B1B3B3", accent: "#C4D2EE" }, // Air Force Blue + Silver

  // NAIA Frontier Conference (football) + NSIC additions — North Dakota /
  // South Dakota cluster. Keys cover the canonical name as stored in the
  // University.name column.
  "valley city state university":     { primary: "#F47B20", secondary: "#000000", accent: "#FBD6C4" }, // VCSU Vikings — Orange + Black
  "dickinson state university":       { primary: "#003594", secondary: "#FFFFFF", accent: "#C4D2EE" }, // DSU Blue Hawks — Blue + White
  "dakota state university":          { primary: "#003B6F", secondary: "#FFFFFF", accent: "#C4D2EE" }, // DSU Trojans — Blue + White
  "mayville state university":        { primary: "#CC0000", secondary: "#FFFFFF", accent: "#F4D4D4" }, // MSU Comets — Red + White
  "university of jamestown":          { primary: "#F76900", secondary: "#000000", accent: "#FBD6C4" }, // Jamestown Jimmies — Orange + Black

  // Other commonly searched
  "georgetown university":            { primary: "#041E42", secondary: "#8A8D8F", accent: "#C4D2EE" }, // Hoya Blue + Gray
  "villanova university":             { primary: "#00205C", secondary: "#13B5EA", accent: "#C4D2EE" }, // Villanova Blue
  "marquette university":             { primary: "#003366", secondary: "#FFCC00", accent: "#FBEDC4" }, // Marquette Blue + Gold
  "gonzaga university":               { primary: "#041E42", secondary: "#B0B7BC", accent: "#C4D2EE" }, // Bulldog Blue + Silver
  "university of dayton":             { primary: "#CE1141", secondary: "#004B8D", accent: "#F4D4DA" }, // Red + Blue
};
