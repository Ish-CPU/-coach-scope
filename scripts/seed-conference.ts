/**
 * Reusable conference seeder.
 *
 *   npm run seed:conference -- GLIAC
 *   npm run seed:conference -- CIAA
 *   npm run seed:conference -- SIAC
 *
 * One script, one registry. Each entry declares the universities in that
 * conference and only the sports each of those universities ACTUALLY
 * sponsors at varsity (per its current athletics website). Sports a school
 * does not field are intentionally omitted — we never create empty
 * placeholder programs.
 *
 * Idempotent + conservative:
 *   - Universities matched by exact name OR slug. Existing rows are reused.
 *     Missing `city` / `state` / `conference` / `websiteUrl` /
 *     `athleticsWebsite` are back-filled. Existing non-null values are
 *     never overwritten.
 *   - Programs (School rows) keyed by `(universityId, sport)`. Missing
 *     `division` (when default) / `conference` (when null) / `athleticsUrl`
 *     (when null) / `seasonYear` (when null) are back-filled. Existing
 *     non-null values are never overwritten.
 *   - Nothing is deleted. No coaches created.
 *
 * Add a new conference in three steps:
 *   1. Add a key to ConferenceKey
 *   2. Add a `ConferenceConfig` to REGISTRY
 *   3. Verify by running `npm run seed:conference -- <KEY>`
 */
import { PrismaClient, Division } from "@prisma/client";
import { normalizeSlug } from "../src/lib/normalize";

const prisma = new PrismaClient();

const SEASON_YEAR = "2025-2026";

// Canonical sport labels — must match the rest of the platform exactly
// (case, apostrophes, possessive form). Renaming here would silently
// create duplicate `(universityId, sport)` rows.
const SPORT = {
  FOOTBALL: "Football",
  BASEBALL: "Baseball",
  SOFTBALL: "Softball",
  MBB: "Men's Basketball",
  WBB: "Women's Basketball",
  MSOC: "Men's Soccer",
  WSOC: "Women's Soccer",
} as const;

type Sport = (typeof SPORT)[keyof typeof SPORT];

interface ProgramSpec {
  sport: Sport;
  /** Sport-specific URL on the athletics site. Optional but recommended. */
  athleticsUrl?: string;
}

interface SchoolSpec {
  name: string;
  city: string;
  state: string;
  /** Institutional homepage. Falls back to athletics site when unknown. */
  websiteUrl?: string;
  /** Athletics homepage. Used as a fallback athleticsUrl on programs. */
  athleticsWebsite: string;
  /** Programs the school actually fields. Sports they don't sponsor are omitted. */
  programs: ProgramSpec[];
}

interface ConferenceConfig {
  /** Human-readable name used in logs. */
  displayName: string;
  /** Conference name as stored on University.conference / School.conference. */
  storedName: string;
  /** University-level + per-program division. */
  division: Division;
  schools: SchoolSpec[];
}

// ---------------------------------------------------------------------------
// REGISTRY
// ---------------------------------------------------------------------------

const GLIAC: ConferenceConfig = {
  displayName: "GLIAC",
  storedName: "GLIAC",
  division: Division.D2,
  schools: [
    {
      name: "Grand Valley State University",
      city: "Allendale",
      state: "MI",
      websiteUrl: "https://www.gvsu.edu",
      athleticsWebsite: "https://gvsulakers.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://gvsulakers.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://gvsulakers.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://gvsulakers.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://gvsulakers.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://gvsulakers.com/sports/womens-basketball" },
        // GVSU does NOT sponsor men's soccer.
        { sport: SPORT.WSOC, athleticsUrl: "https://gvsulakers.com/sports/womens-soccer" },
      ],
    },
    {
      name: "Ferris State University",
      city: "Big Rapids",
      state: "MI",
      websiteUrl: "https://www.ferris.edu",
      athleticsWebsite: "https://ferrisstatebulldogs.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://ferrisstatebulldogs.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://ferrisstatebulldogs.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://ferrisstatebulldogs.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://ferrisstatebulldogs.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://ferrisstatebulldogs.com/sports/womens-basketball" },
        { sport: SPORT.WSOC, athleticsUrl: "https://ferrisstatebulldogs.com/sports/womens-soccer" },
      ],
    },
    {
      name: "Saginaw Valley State University",
      city: "University Center",
      state: "MI",
      websiteUrl: "https://www.svsu.edu",
      athleticsWebsite: "https://svsucardinals.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://svsucardinals.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://svsucardinals.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://svsucardinals.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://svsucardinals.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://svsucardinals.com/sports/womens-basketball" },
        { sport: SPORT.WSOC, athleticsUrl: "https://svsucardinals.com/sports/womens-soccer" },
      ],
    },
    {
      name: "Wayne State University",
      city: "Detroit",
      state: "MI",
      websiteUrl: "https://wayne.edu",
      athleticsWebsite: "https://wsuathletics.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://wsuathletics.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://wsuathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://wsuathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://wsuathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://wsuathletics.com/sports/womens-basketball" },
        { sport: SPORT.MSOC, athleticsUrl: "https://wsuathletics.com/sports/mens-soccer" },
        { sport: SPORT.WSOC, athleticsUrl: "https://wsuathletics.com/sports/womens-soccer" },
      ],
    },
    {
      name: "Davenport University",
      city: "Grand Rapids",
      state: "MI",
      websiteUrl: "https://www.davenport.edu",
      athleticsWebsite: "https://dupanthers.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://dupanthers.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://dupanthers.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://dupanthers.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://dupanthers.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://dupanthers.com/sports/womens-basketball" },
        { sport: SPORT.MSOC, athleticsUrl: "https://dupanthers.com/sports/mens-soccer" },
        { sport: SPORT.WSOC, athleticsUrl: "https://dupanthers.com/sports/womens-soccer" },
      ],
    },
    {
      name: "Michigan Tech University",
      city: "Houghton",
      state: "MI",
      websiteUrl: "https://www.mtu.edu",
      athleticsWebsite: "https://michigantechhuskies.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://michigantechhuskies.com/sports/football" },
        // Michigan Tech does NOT sponsor varsity baseball or softball.
        { sport: SPORT.MBB, athleticsUrl: "https://michigantechhuskies.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://michigantechhuskies.com/sports/womens-basketball" },
        { sport: SPORT.WSOC, athleticsUrl: "https://michigantechhuskies.com/sports/womens-soccer" },
      ],
    },
    {
      name: "Northern Michigan University",
      city: "Marquette",
      state: "MI",
      websiteUrl: "https://www.nmu.edu",
      athleticsWebsite: "https://nmuwildcats.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://nmuwildcats.com/sports/football" },
        // NMU does NOT sponsor varsity baseball or softball.
        { sport: SPORT.MBB, athleticsUrl: "https://nmuwildcats.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://nmuwildcats.com/sports/womens-basketball" },
        { sport: SPORT.WSOC, athleticsUrl: "https://nmuwildcats.com/sports/womens-soccer" },
      ],
    },
    {
      name: "Lake Superior State University",
      city: "Sault Ste. Marie",
      state: "MI",
      websiteUrl: "https://www.lssu.edu",
      athleticsWebsite: "https://lssuathletics.com",
      programs: [
        // Lake Superior State does NOT sponsor varsity football.
        { sport: SPORT.BASEBALL, athleticsUrl: "https://lssuathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://lssuathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://lssuathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://lssuathletics.com/sports/womens-basketball" },
        { sport: SPORT.WSOC, athleticsUrl: "https://lssuathletics.com/sports/womens-soccer" },
      ],
    },
    {
      name: "Purdue University Northwest",
      city: "Hammond",
      state: "IN",
      websiteUrl: "https://www.pnw.edu",
      athleticsWebsite: "https://pnwathletics.com",
      programs: [
        // PNW does NOT sponsor varsity football.
        { sport: SPORT.BASEBALL, athleticsUrl: "https://pnwathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://pnwathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://pnwathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://pnwathletics.com/sports/womens-basketball" },
        { sport: SPORT.MSOC, athleticsUrl: "https://pnwathletics.com/sports/mens-soccer" },
        { sport: SPORT.WSOC, athleticsUrl: "https://pnwathletics.com/sports/womens-soccer" },
      ],
    },
    {
      name: "University of Wisconsin-Parkside",
      city: "Kenosha",
      state: "WI",
      websiteUrl: "https://www.uwp.edu",
      athleticsWebsite: "https://parksideathletics.com",
      programs: [
        // Parkside does NOT sponsor varsity football.
        { sport: SPORT.BASEBALL, athleticsUrl: "https://parksideathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://parksideathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://parksideathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://parksideathletics.com/sports/womens-basketball" },
        { sport: SPORT.MSOC, athleticsUrl: "https://parksideathletics.com/sports/mens-soccer" },
        { sport: SPORT.WSOC, athleticsUrl: "https://parksideathletics.com/sports/womens-soccer" },
      ],
    },
    {
      name: "Roosevelt University",
      city: "Chicago",
      state: "IL",
      websiteUrl: "https://www.roosevelt.edu",
      athleticsWebsite: "https://rooseveltlakers.com",
      programs: [
        // Roosevelt does NOT sponsor varsity football.
        { sport: SPORT.BASEBALL, athleticsUrl: "https://rooseveltlakers.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://rooseveltlakers.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://rooseveltlakers.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://rooseveltlakers.com/sports/womens-basketball" },
        { sport: SPORT.MSOC, athleticsUrl: "https://rooseveltlakers.com/sports/mens-soccer" },
        { sport: SPORT.WSOC, athleticsUrl: "https://rooseveltlakers.com/sports/womens-soccer" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// CIAA — Central Intercollegiate Athletic Association (D2 HBCU)
// Sport sponsorship per each member's official athletics site.
// ---------------------------------------------------------------------------
const CIAA: ConferenceConfig = {
  displayName: "CIAA",
  storedName: "CIAA",
  division: Division.D2,
  schools: [
    {
      name: "Bowie State University",
      city: "Bowie",
      state: "MD",
      websiteUrl: "https://www.bowiestate.edu",
      athleticsWebsite: "https://bsubulldogs.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://bsubulldogs.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://bsubulldogs.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://bsubulldogs.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://bsubulldogs.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://bsubulldogs.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Claflin University",
      city: "Orangeburg",
      state: "SC",
      websiteUrl: "https://www.claflin.edu",
      athleticsWebsite: "https://goclaflinathletics.com",
      programs: [
        // Claflin does NOT sponsor football.
        { sport: SPORT.BASEBALL, athleticsUrl: "https://goclaflinathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://goclaflinathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://goclaflinathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://goclaflinathletics.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Elizabeth City State University",
      city: "Elizabeth City",
      state: "NC",
      websiteUrl: "https://www.ecsu.edu",
      athleticsWebsite: "https://ecsuvikings.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://ecsuvikings.com/sports/football" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://ecsuvikings.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://ecsuvikings.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://ecsuvikings.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Fayetteville State University",
      city: "Fayetteville",
      state: "NC",
      websiteUrl: "https://www.uncfsu.edu",
      athleticsWebsite: "https://fsubroncos.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://fsubroncos.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://fsubroncos.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://fsubroncos.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://fsubroncos.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://fsubroncos.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Johnson C. Smith University",
      city: "Charlotte",
      state: "NC",
      websiteUrl: "https://www.jcsu.edu",
      athleticsWebsite: "https://jcsuathletics.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://jcsuathletics.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://jcsuathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://jcsuathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://jcsuathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://jcsuathletics.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Lincoln University Pennsylvania",
      city: "Lincoln University",
      state: "PA",
      websiteUrl: "https://www.lincoln.edu",
      athleticsWebsite: "https://lincolnlionsathletics.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://lincolnlionsathletics.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://lincolnlionsathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://lincolnlionsathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://lincolnlionsathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://lincolnlionsathletics.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Livingstone College",
      city: "Salisbury",
      state: "NC",
      websiteUrl: "https://www.livingstone.edu",
      athleticsWebsite: "https://livingstoneblues.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://livingstoneblues.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://livingstoneblues.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://livingstoneblues.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://livingstoneblues.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://livingstoneblues.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Saint Augustine's University",
      city: "Raleigh",
      state: "NC",
      websiteUrl: "https://www.st-aug.edu",
      athleticsWebsite: "https://saufalcons.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://saufalcons.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://saufalcons.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://saufalcons.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://saufalcons.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://saufalcons.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Shaw University",
      city: "Raleigh",
      state: "NC",
      websiteUrl: "https://www.shawu.edu",
      athleticsWebsite: "https://shawbears.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://shawbears.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://shawbears.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://shawbears.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://shawbears.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://shawbears.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Virginia State University",
      city: "Petersburg",
      state: "VA",
      websiteUrl: "https://www.vsu.edu",
      athleticsWebsite: "https://vsutrojans.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://vsutrojans.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://vsutrojans.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://vsutrojans.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://vsutrojans.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://vsutrojans.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Virginia Union University",
      city: "Richmond",
      state: "VA",
      websiteUrl: "https://www.vuu.edu",
      athleticsWebsite: "https://vuusports.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://vuusports.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://vuusports.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://vuusports.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://vuusports.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://vuusports.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Winston-Salem State University",
      city: "Winston-Salem",
      state: "NC",
      websiteUrl: "https://www.wssu.edu",
      athleticsWebsite: "https://wssurams.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://wssurams.com/sports/football" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://wssurams.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://wssurams.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://wssurams.com/sports/womens-basketball" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// SIAC — Southern Intercollegiate Athletic Conference (D2 HBCU)
// Sport sponsorship per each member's official athletics site.
// ---------------------------------------------------------------------------
const SIAC: ConferenceConfig = {
  displayName: "SIAC",
  storedName: "SIAC",
  division: Division.D2,
  schools: [
    {
      name: "Albany State University",
      city: "Albany",
      state: "GA",
      websiteUrl: "https://www.asurams.edu",
      athleticsWebsite: "https://asuramsathletics.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://asuramsathletics.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://asuramsathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://asuramsathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://asuramsathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://asuramsathletics.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Allen University",
      city: "Columbia",
      state: "SC",
      websiteUrl: "https://www.allenuniversity.edu",
      athleticsWebsite: "https://allenuniversityathletics.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://allenuniversityathletics.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://allenuniversityathletics.com/sports/baseball" },
        { sport: SPORT.MBB, athleticsUrl: "https://allenuniversityathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://allenuniversityathletics.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Benedict College",
      city: "Columbia",
      state: "SC",
      websiteUrl: "https://www.benedict.edu",
      athleticsWebsite: "https://bctigers.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://bctigers.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://bctigers.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://bctigers.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://bctigers.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://bctigers.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Central State University",
      city: "Wilberforce",
      state: "OH",
      websiteUrl: "https://www.centralstate.edu",
      athleticsWebsite: "https://csumarauders.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://csumarauders.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://csumarauders.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://csumarauders.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://csumarauders.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://csumarauders.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Clark Atlanta University",
      city: "Atlanta",
      state: "GA",
      websiteUrl: "https://www.cau.edu",
      athleticsWebsite: "https://caupanthers.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://caupanthers.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://caupanthers.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://caupanthers.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://caupanthers.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://caupanthers.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Edward Waters University",
      city: "Jacksonville",
      state: "FL",
      websiteUrl: "https://www.ewc.edu",
      athleticsWebsite: "https://ewutigers.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://ewutigers.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://ewutigers.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://ewutigers.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://ewutigers.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://ewutigers.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Fort Valley State University",
      city: "Fort Valley",
      state: "GA",
      websiteUrl: "https://www.fvsu.edu",
      athleticsWebsite: "https://fvsuathletics.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://fvsuathletics.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://fvsuathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://fvsuathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://fvsuathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://fvsuathletics.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Kentucky State University",
      city: "Frankfort",
      state: "KY",
      websiteUrl: "https://kysu.edu",
      athleticsWebsite: "https://ksuthorobreds.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://ksuthorobreds.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://ksuthorobreds.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://ksuthorobreds.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://ksuthorobreds.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://ksuthorobreds.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Lane College",
      city: "Jackson",
      state: "TN",
      websiteUrl: "https://www.lanecollege.edu",
      athleticsWebsite: "https://lanedragons.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://lanedragons.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://lanedragons.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://lanedragons.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://lanedragons.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://lanedragons.com/sports/womens-basketball" },
      ],
    },
    {
      name: "LeMoyne-Owen College",
      city: "Memphis",
      state: "TN",
      websiteUrl: "https://www.loc.edu",
      athleticsWebsite: "https://lemoyneowenmagicians.com",
      programs: [
        // LeMoyne-Owen does NOT sponsor varsity football.
        { sport: SPORT.BASEBALL, athleticsUrl: "https://lemoyneowenmagicians.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://lemoyneowenmagicians.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://lemoyneowenmagicians.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://lemoyneowenmagicians.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Miles College",
      city: "Fairfield",
      state: "AL",
      websiteUrl: "https://www.miles.edu",
      athleticsWebsite: "https://milesgoldenbears.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://milesgoldenbears.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://milesgoldenbears.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://milesgoldenbears.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://milesgoldenbears.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://milesgoldenbears.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Morehouse College",
      city: "Atlanta",
      state: "GA",
      websiteUrl: "https://www.morehouse.edu",
      athleticsWebsite: "https://morehousetigers.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://morehousetigers.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://morehousetigers.com/sports/baseball" },
        { sport: SPORT.MBB, athleticsUrl: "https://morehousetigers.com/sports/mens-basketball" },
      ],
    },
    {
      name: "Savannah State University",
      city: "Savannah",
      state: "GA",
      websiteUrl: "https://www.savannahstate.edu",
      athleticsWebsite: "https://ssutigers.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://ssutigers.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://ssutigers.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://ssutigers.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://ssutigers.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://ssutigers.com/sports/womens-basketball" },
      ],
    },
    {
      name: "Tuskegee University",
      city: "Tuskegee",
      state: "AL",
      websiteUrl: "https://www.tuskegee.edu",
      athleticsWebsite: "https://tuskegeeathletics.com",
      programs: [
        { sport: SPORT.FOOTBALL, athleticsUrl: "https://tuskegeeathletics.com/sports/football" },
        { sport: SPORT.BASEBALL, athleticsUrl: "https://tuskegeeathletics.com/sports/baseball" },
        { sport: SPORT.SOFTBALL, athleticsUrl: "https://tuskegeeathletics.com/sports/softball" },
        { sport: SPORT.MBB, athleticsUrl: "https://tuskegeeathletics.com/sports/mens-basketball" },
        { sport: SPORT.WBB, athleticsUrl: "https://tuskegeeathletics.com/sports/womens-basketball" },
      ],
    },
  ],
};

const REGISTRY: Record<string, ConferenceConfig> = {
  GLIAC,
  CIAA,
  SIAC,
};

// ---------------------------------------------------------------------------
// Idempotent upserts
// ---------------------------------------------------------------------------

interface SeedStats {
  universitiesCreated: number;
  universitiesReused: number;
  universitiesPatched: number;
  programsCreated: number;
  programsSkipped: number;
  programsPatched: number;
  errors: { school: string; sport?: string; message: string }[];
}

type UniversityOutcome = "created" | "reused" | "patched";
type ProgramOutcome = "created" | "skipped" | "patched";

async function findOrUpsertUniversity(
  spec: SchoolSpec,
  conf: ConferenceConfig
): Promise<{ id: string; outcome: UniversityOutcome }> {
  const slug = normalizeSlug(spec.name);

  const existing = await prisma.university.findFirst({
    where: {
      OR: [{ name: spec.name }, slug ? { slug } : undefined].filter(
        (x): x is { name: string } | { slug: string } => Boolean(x)
      ),
    },
    select: {
      id: true,
      city: true,
      state: true,
      conference: true,
      websiteUrl: true,
      athleticsWebsite: true,
    },
  });

  if (!existing) {
    const created = await prisma.university.create({
      data: {
        name: spec.name,
        slug: slug ?? undefined,
        city: spec.city,
        state: spec.state,
        country: "USA",
        level: conf.division,
        conference: conf.storedName,
        websiteUrl: spec.websiteUrl ?? null,
        athleticsWebsite: spec.athleticsWebsite,
      },
      select: { id: true },
    });
    return { id: created.id, outcome: "created" };
  }

  // Patch only missing fields. Never overwrite a non-null value.
  const patch: {
    city?: string;
    state?: string;
    conference?: string;
    websiteUrl?: string;
    athleticsWebsite?: string;
  } = {};
  if (!existing.city) patch.city = spec.city;
  if (!existing.state) patch.state = spec.state;
  if (!existing.conference) patch.conference = conf.storedName;
  if (!existing.websiteUrl && spec.websiteUrl) patch.websiteUrl = spec.websiteUrl;
  if (!existing.athleticsWebsite) patch.athleticsWebsite = spec.athleticsWebsite;

  if (Object.keys(patch).length === 0) {
    return { id: existing.id, outcome: "reused" };
  }

  await prisma.university.update({ where: { id: existing.id }, data: patch });
  return { id: existing.id, outcome: "patched" };
}

async function findOrUpsertProgram(
  universityId: string,
  program: ProgramSpec,
  conf: ConferenceConfig
): Promise<ProgramOutcome> {
  const existing = await prisma.school.findUnique({
    where: { universityId_sport: { universityId, sport: program.sport } },
    select: {
      id: true,
      division: true,
      conference: true,
      athleticsUrl: true,
      seasonYear: true,
    },
  });

  if (!existing) {
    await prisma.school.create({
      data: {
        universityId,
        sport: program.sport,
        division: conf.division,
        conference: conf.storedName,
        athleticsUrl: program.athleticsUrl ?? null,
        seasonYear: SEASON_YEAR,
      },
    });
    return "created";
  }

  const patch: {
    division?: Division;
    conference?: string;
    athleticsUrl?: string;
    seasonYear?: string;
  } = {};

  // Treat the schema default (D1) as effectively-unset for non-D1 conferences.
  if (existing.division !== conf.division) patch.division = conf.division;
  if (!existing.conference) patch.conference = conf.storedName;
  if (!existing.athleticsUrl && program.athleticsUrl) {
    patch.athleticsUrl = program.athleticsUrl;
  }
  if (!existing.seasonYear) patch.seasonYear = SEASON_YEAR;

  if (Object.keys(patch).length === 0) return "skipped";

  await prisma.school.update({ where: { id: existing.id }, data: patch });
  return "patched";
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

async function main() {
  const key = process.argv[2]?.toUpperCase();
  const conf = key ? REGISTRY[key] : undefined;

  if (!conf) {
    const available = Object.keys(REGISTRY).join(", ");
    console.error(
      `${key ? `Unknown conference "${process.argv[2]}". ` : "No conference key provided. "}` +
        `Available conferences: ${available}\n` +
        `Usage: npm run seed:conference -- ${available.split(",")[0].trim()}`
    );
    process.exit(1);
  }

  const totalPrograms = conf.schools.reduce((acc, s) => acc + s.programs.length, 0);
  console.log(
    `🏟️  Seeding ${conf.displayName}: ${conf.schools.length} universities and ${totalPrograms} sport programs…\n`
  );

  const stats: SeedStats = {
    universitiesCreated: 0,
    universitiesReused: 0,
    universitiesPatched: 0,
    programsCreated: 0,
    programsSkipped: 0,
    programsPatched: 0,
    errors: [],
  };

  for (const school of conf.schools) {
    let universityId: string;
    try {
      const u = await findOrUpsertUniversity(school, conf);
      universityId = u.id;
      if (u.outcome === "created") {
        stats.universitiesCreated++;
        console.log(`✅  created university:  ${school.name}`);
      } else if (u.outcome === "patched") {
        stats.universitiesPatched++;
        console.log(`🔧  patched university:  ${school.name} (back-filled missing metadata)`);
      } else {
        stats.universitiesReused++;
        console.log(`♻️   reused university:   ${school.name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stats.errors.push({ school: school.name, message });
      console.error(`❌  university failed (${school.name}): ${message}`);
      continue;
    }

    for (const program of school.programs) {
      try {
        const outcome = await findOrUpsertProgram(universityId, program, conf);
        if (outcome === "created") {
          stats.programsCreated++;
          console.log(`   ✅  created program:  ${school.name} — ${program.sport}`);
        } else if (outcome === "patched") {
          stats.programsPatched++;
          console.log(
            `   🔧  patched program:  ${school.name} — ${program.sport} (back-filled missing metadata)`
          );
        } else {
          stats.programsSkipped++;
          console.log(
            `   ⏭️   skipped program:  ${school.name} — ${program.sport} (already complete)`
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        stats.errors.push({ school: school.name, sport: program.sport, message });
        console.error(
          `   ❌  program failed (${school.name} — ${program.sport}): ${message}`
        );
      }
    }
  }

  console.log(`\n--- Summary (${conf.displayName}) ---`);
  console.log(`Universities created:    ${stats.universitiesCreated}`);
  console.log(`Universities patched:    ${stats.universitiesPatched}  (back-filled missing city/state/conference/url)`);
  console.log(`Universities reused:     ${stats.universitiesReused}`);
  console.log(`Programs created:        ${stats.programsCreated}`);
  console.log(`Programs patched:        ${stats.programsPatched}  (back-filled missing division/conference/url/season)`);
  console.log(`Programs skipped:        ${stats.programsSkipped}  (already complete)`);
  console.log(`Errors:                  ${stats.errors.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
