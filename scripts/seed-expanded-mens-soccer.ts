/**
 * Seed expanded Men's Soccer coverage across every NCAA tier.
 *
 * Conservative + idempotent (same contract as seed-major-football-programs.ts,
 * seed-major-womens-basketball-programs.ts, and seed-major-womens-soccer-programs.ts):
 *   - University rows that already exist (matched by exact name OR slug) are
 *     reused — never overwritten.
 *   - Men's Soccer School rows that already exist for that university
 *     are skipped — we never create a duplicate (universityId, "Men's Soccer").
 *   - Coaches are NOT created here. Attach verified coaches via the CSV
 *     importer once the head coach is confirmed by name + source URL.
 *
 * Sport: "Men's Soccer" (Men).
 *
 * Notes specific to men's soccer:
 *   - Many SEC and Big 12 schools do NOT sponsor men's soccer. We intentionally
 *     do NOT seed those tiers here — coverage is by conference that actually
 *     sponsors men's soccer.
 *   - Some schools play their men's soccer in a different conference than
 *     football/basketball (e.g. Marshall, West Virginia, JMU in Sun Belt MSOC).
 *
 * Usage:
 *   npm run seed:mens-soccer-expanded
 *
 * Add new schools at the bottom of MSOC_PROGRAMS — keep grouped by tier
 * and conference so the diff stays reviewable.
 */
import { PrismaClient, Division } from "@prisma/client";
import { normalizeSlug } from "../src/lib/normalize";

const prisma = new PrismaClient();

const SPORT = "Men's Soccer";

interface MSocSeed {
  universityName: string;
  city?: string;
  state?: string;
  websiteUrl?: string;
  athleticsWebsite?: string;
  level: Division;          // university-level division
  conference: string;       // men's soccer conference
  tierLabel: string;        // console-output tag only
}

// ---------------------------------------------------------------------------
// Real, currently-active Men's Soccer programs only. Do not invent.
// Each addition must be verifiable against an official athletics website or
// NCAA/NAIA/NJCAA conference page.
// ---------------------------------------------------------------------------
const MSOC_PROGRAMS: MSocSeed[] = [
  // --- D1 Big West ---------------------------------------------------------
  { universityName: "University of California, Davis", city: "Davis", state: "CA", athleticsWebsite: "https://ucdavisaggies.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of California, Irvine", city: "Irvine", state: "CA", athleticsWebsite: "https://ucirvinesports.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of California, Riverside", city: "Riverside", state: "CA", athleticsWebsite: "https://gohighlanders.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of California, San Diego", city: "La Jolla", state: "CA", athleticsWebsite: "https://ucsdtritons.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of California, Santa Barbara", city: "Santa Barbara", state: "CA", athleticsWebsite: "https://ucsbgauchos.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "California Polytechnic State University", city: "San Luis Obispo", state: "CA", athleticsWebsite: "https://gopoly.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "California State University, Bakersfield", city: "Bakersfield", state: "CA", athleticsWebsite: "https://gorunners.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "California State University, Northridge", city: "Northridge", state: "CA", athleticsWebsite: "https://gomatadors.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "California State University, Fullerton", city: "Fullerton", state: "CA", athleticsWebsite: "https://fullertontitans.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },

  // --- D1 West Coast Conference (WCC) --------------------------------------
  { universityName: "Gonzaga University", city: "Spokane", state: "WA", athleticsWebsite: "https://gozags.com", level: Division.D1, conference: "West Coast Conference", tierLabel: "D1 / WCC" },
  { universityName: "Loyola Marymount University", city: "Los Angeles", state: "CA", athleticsWebsite: "https://lmulions.com", level: Division.D1, conference: "West Coast Conference", tierLabel: "D1 / WCC" },
  { universityName: "University of the Pacific", city: "Stockton", state: "CA", athleticsWebsite: "https://pacifictigers.com", level: Division.D1, conference: "West Coast Conference", tierLabel: "D1 / WCC" },
  { universityName: "Pepperdine University", city: "Malibu", state: "CA", athleticsWebsite: "https://pepperdinewaves.com", level: Division.D1, conference: "West Coast Conference", tierLabel: "D1 / WCC" },
  { universityName: "University of Portland", city: "Portland", state: "OR", athleticsWebsite: "https://portlandpilots.com", level: Division.D1, conference: "West Coast Conference", tierLabel: "D1 / WCC" },
  { universityName: "Saint Mary's College of California", city: "Moraga", state: "CA", athleticsWebsite: "https://smcgaels.com", level: Division.D1, conference: "West Coast Conference", tierLabel: "D1 / WCC" },
  { universityName: "University of San Diego", city: "San Diego", state: "CA", athleticsWebsite: "https://usdtoreros.com", level: Division.D1, conference: "West Coast Conference", tierLabel: "D1 / WCC" },
  { universityName: "University of San Francisco", city: "San Francisco", state: "CA", athleticsWebsite: "https://usfdons.com", level: Division.D1, conference: "West Coast Conference", tierLabel: "D1 / WCC" },
  { universityName: "Santa Clara University", city: "Santa Clara", state: "CA", athleticsWebsite: "https://santaclarabroncos.com", level: Division.D1, conference: "West Coast Conference", tierLabel: "D1 / WCC" },

  // --- D1 Missouri Valley Conference (MVC) ---------------------------------
  { universityName: "Belmont University", city: "Nashville", state: "TN", athleticsWebsite: "https://belmontbruins.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Bradley University", city: "Peoria", state: "IL", athleticsWebsite: "https://bradleybraves.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Drake University", city: "Des Moines", state: "IA", athleticsWebsite: "https://godrakebulldogs.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "University of Evansville", city: "Evansville", state: "IN", athleticsWebsite: "https://gopurpleaces.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Loyola University Chicago", city: "Chicago", state: "IL", athleticsWebsite: "https://loyolaramblers.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Missouri State University", city: "Springfield", state: "MO", athleticsWebsite: "https://missouristatebears.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "University of Illinois Chicago", city: "Chicago", state: "IL", athleticsWebsite: "https://uicflames.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Valparaiso University", city: "Valparaiso", state: "IN", athleticsWebsite: "https://valpoathletics.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },

  // --- D1 Summit League ----------------------------------------------------
  { universityName: "University of Denver", city: "Denver", state: "CO", athleticsWebsite: "https://denverpioneers.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "University of Nebraska Omaha", city: "Omaha", state: "NE", athleticsWebsite: "https://omavs.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "Oral Roberts University", city: "Tulsa", state: "OK", athleticsWebsite: "https://oruathletics.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "University of St. Thomas Minnesota", city: "Saint Paul", state: "MN", athleticsWebsite: "https://tommiesports.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },

  // --- D1 Horizon League ---------------------------------------------------
  { universityName: "Cleveland State University", city: "Cleveland", state: "OH", athleticsWebsite: "https://csuvikings.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "University of Detroit Mercy", city: "Detroit", state: "MI", athleticsWebsite: "https://detroittitans.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "University of Green Bay", city: "Green Bay", state: "WI", athleticsWebsite: "https://greenbayphoenix.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "University of Wisconsin-Milwaukee", city: "Milwaukee", state: "WI", athleticsWebsite: "https://mkepanthers.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Northern Kentucky University", city: "Highland Heights", state: "KY", athleticsWebsite: "https://nkunorse.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Oakland University", city: "Rochester", state: "MI", athleticsWebsite: "https://goldengrizzlies.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Purdue University Fort Wayne", city: "Fort Wayne", state: "IN", athleticsWebsite: "https://gomastodons.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Robert Morris University", city: "Moon Township", state: "PA", athleticsWebsite: "https://rmucolonials.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Wright State University", city: "Dayton", state: "OH", athleticsWebsite: "https://wsuraiders.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Youngstown State University", city: "Youngstown", state: "OH", athleticsWebsite: "https://ysusports.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },

  // --- D1 ASUN Conference --------------------------------------------------
  { universityName: "Bellarmine University", city: "Louisville", state: "KY", athleticsWebsite: "https://athletics.bellarmine.edu", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Florida Gulf Coast University", city: "Fort Myers", state: "FL", athleticsWebsite: "https://fgcuathletics.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Jacksonville University", city: "Jacksonville", state: "FL", athleticsWebsite: "https://judolphins.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Liberty University", city: "Lynchburg", state: "VA", athleticsWebsite: "https://libertyflames.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Lipscomb University", city: "Nashville", state: "TN", athleticsWebsite: "https://lipscombsports.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "University of North Alabama", city: "Florence", state: "AL", athleticsWebsite: "https://roarlions.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "University of North Florida", city: "Jacksonville", state: "FL", athleticsWebsite: "https://unfospreys.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Queens University of Charlotte", city: "Charlotte", state: "NC", athleticsWebsite: "https://queensathletics.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Stetson University", city: "DeLand", state: "FL", athleticsWebsite: "https://gohatters.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },

  // --- D1 American Athletic Conference (AAC) -------------------------------
  { universityName: "University of North Carolina at Charlotte", city: "Charlotte", state: "NC", athleticsWebsite: "https://charlotte49ers.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Florida Atlantic University", city: "Boca Raton", state: "FL", athleticsWebsite: "https://fausports.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Memphis", city: "Memphis", state: "TN", athleticsWebsite: "https://gotigersgo.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Southern Methodist University", city: "Dallas", state: "TX", athleticsWebsite: "https://smumustangs.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of South Florida", city: "Tampa", state: "FL", athleticsWebsite: "https://gousfbulls.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Temple University", city: "Philadelphia", state: "PA", athleticsWebsite: "https://owlsports.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Tulsa University", city: "Tulsa", state: "OK", athleticsWebsite: "https://tulsahurricane.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },

  // --- D1 Sun Belt Conference ----------------------------------------------
  { universityName: "Coastal Carolina University", city: "Conway", state: "SC", athleticsWebsite: "https://goccusports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Georgia Southern University", city: "Statesboro", state: "GA", athleticsWebsite: "https://gseagles.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Georgia State University", city: "Atlanta", state: "GA", athleticsWebsite: "https://georgiastatesports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "James Madison University", city: "Harrisonburg", state: "VA", athleticsWebsite: "https://jmusports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Marshall University", city: "Huntington", state: "WV", athleticsWebsite: "https://herdzone.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Old Dominion University", city: "Norfolk", state: "VA", athleticsWebsite: "https://odusports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "West Virginia University", city: "Morgantown", state: "WV", athleticsWebsite: "https://wvusports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },

  // --- D1 Big East Conference ----------------------------------------------
  { universityName: "Butler University", city: "Indianapolis", state: "IN", athleticsWebsite: "https://butlersports.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "University of Connecticut", city: "Storrs", state: "CT", athleticsWebsite: "https://uconnhuskies.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Creighton University", city: "Omaha", state: "NE", athleticsWebsite: "https://gocreighton.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "DePaul University", city: "Chicago", state: "IL", athleticsWebsite: "https://depaulbluedemons.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Georgetown University", city: "Washington", state: "DC", athleticsWebsite: "https://guhoyas.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Marquette University", city: "Milwaukee", state: "WI", athleticsWebsite: "https://gomarquette.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Providence College", city: "Providence", state: "RI", athleticsWebsite: "https://friars.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Seton Hall University", city: "South Orange", state: "NJ", athleticsWebsite: "https://shupirates.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "St. John's University", city: "Queens", state: "NY", athleticsWebsite: "https://redstormsports.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Villanova University", city: "Villanova", state: "PA", athleticsWebsite: "https://villanova.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Xavier University", city: "Cincinnati", state: "OH", athleticsWebsite: "https://goxavier.com", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },

  // --- D1 Ivy League -------------------------------------------------------
  { universityName: "Brown University", city: "Providence", state: "RI", athleticsWebsite: "https://brownbears.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Columbia University", city: "New York", state: "NY", athleticsWebsite: "https://gocolumbialions.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Cornell University", city: "Ithaca", state: "NY", athleticsWebsite: "https://cornellbigred.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Dartmouth College", city: "Hanover", state: "NH", athleticsWebsite: "https://dartmouthsports.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Harvard University", city: "Cambridge", state: "MA", athleticsWebsite: "https://gocrimson.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "University of Pennsylvania", city: "Philadelphia", state: "PA", athleticsWebsite: "https://pennathletics.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Princeton University", city: "Princeton", state: "NJ", athleticsWebsite: "https://goprincetontigers.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Yale University", city: "New Haven", state: "CT", athleticsWebsite: "https://yalebulldogs.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },

  // --- D1 Patriot League ---------------------------------------------------
  { universityName: "American University", city: "Washington", state: "DC", athleticsWebsite: "https://aueagles.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Army West Point", city: "West Point", state: "NY", athleticsWebsite: "https://goarmywestpoint.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Boston University", city: "Boston", state: "MA", athleticsWebsite: "https://goterriers.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Bucknell University", city: "Lewisburg", state: "PA", athleticsWebsite: "https://bucknellbison.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Colgate University", city: "Hamilton", state: "NY", athleticsWebsite: "https://gocolgateraiders.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "College of the Holy Cross", city: "Worcester", state: "MA", athleticsWebsite: "https://goholycross.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Lafayette College", city: "Easton", state: "PA", athleticsWebsite: "https://goleopards.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Lehigh University", city: "Bethlehem", state: "PA", athleticsWebsite: "https://lehighsports.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Loyola University Maryland", city: "Baltimore", state: "MD", athleticsWebsite: "https://loyolagreyhounds.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "United States Naval Academy", city: "Annapolis", state: "MD", athleticsWebsite: "https://navysports.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },

  // --- D1 Atlantic 10 (A-10) -----------------------------------------------
  { universityName: "Davidson College", city: "Davidson", state: "NC", athleticsWebsite: "https://davidsonwildcats.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "University of Dayton", city: "Dayton", state: "OH", athleticsWebsite: "https://daytonflyers.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Duquesne University", city: "Pittsburgh", state: "PA", athleticsWebsite: "https://goduquesne.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Fordham University", city: "Bronx", state: "NY", athleticsWebsite: "https://fordhamsports.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "George Mason University", city: "Fairfax", state: "VA", athleticsWebsite: "https://gomason.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "George Washington University", city: "Washington", state: "DC", athleticsWebsite: "https://gwsports.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "La Salle University", city: "Philadelphia", state: "PA", athleticsWebsite: "https://goexplorers.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "University of Massachusetts", city: "Amherst", state: "MA", athleticsWebsite: "https://umassathletics.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "University of Rhode Island", city: "Kingston", state: "RI", athleticsWebsite: "https://gorhody.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Saint Joseph's University", city: "Philadelphia", state: "PA", athleticsWebsite: "https://sjuhawks.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Saint Louis University", city: "Saint Louis", state: "MO", athleticsWebsite: "https://slubillikens.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Virginia Commonwealth University", city: "Richmond", state: "VA", athleticsWebsite: "https://vcuathletics.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },

  // --- D1 Mid-American Conference (MAC) ------------------------------------
  { universityName: "University of Akron", city: "Akron", state: "OH", athleticsWebsite: "https://gozips.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Bowling Green State University", city: "Bowling Green", state: "OH", athleticsWebsite: "https://bgsufalcons.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "University at Buffalo", city: "Buffalo", state: "NY", athleticsWebsite: "https://ubbulls.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Northern Illinois University", city: "DeKalb", state: "IL", athleticsWebsite: "https://niuhuskies.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Western Michigan University", city: "Kalamazoo", state: "MI", athleticsWebsite: "https://wmubroncos.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },

  // --- D1 Southern Conference (SoCon) --------------------------------------
  { universityName: "East Tennessee State University", city: "Johnson City", state: "TN", athleticsWebsite: "https://etsubucs.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Furman University", city: "Greenville", state: "SC", athleticsWebsite: "https://furmanpaladins.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Mercer University", city: "Macon", state: "GA", athleticsWebsite: "https://mercerbears.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "University of North Carolina at Greensboro", city: "Greensboro", state: "NC", athleticsWebsite: "https://uncgspartans.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Western Carolina University", city: "Cullowhee", state: "NC", athleticsWebsite: "https://catamountsports.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Wofford College", city: "Spartanburg", state: "SC", athleticsWebsite: "https://woffordterriers.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },

  // --- D2 Great Lakes Valley Conference (GLVC) -----------------------------
  { universityName: "Drury University", city: "Springfield", state: "MO", athleticsWebsite: "https://drurypanthers.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "University of Indianapolis", city: "Indianapolis", state: "IN", athleticsWebsite: "https://athletics.uindy.edu", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Lewis University", city: "Romeoville", state: "IL", athleticsWebsite: "https://lewisflyers.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Maryville University Saint Louis", city: "Saint Louis", state: "MO", athleticsWebsite: "https://maryvilleathletics.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "McKendree University", city: "Lebanon", state: "IL", athleticsWebsite: "https://mckbearcats.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Missouri S&T", city: "Rolla", state: "MO", athleticsWebsite: "https://minerathletics.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Quincy University", city: "Quincy", state: "IL", athleticsWebsite: "https://quincyhawks.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Rockhurst University", city: "Kansas City", state: "MO", athleticsWebsite: "https://rockhursthawks.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Truman State University", city: "Kirksville", state: "MO", athleticsWebsite: "https://trumanbulldogs.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "University of Illinois Springfield", city: "Springfield", state: "IL", athleticsWebsite: "https://uisprairiestars.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "University of Missouri-St. Louis", city: "Saint Louis", state: "MO", athleticsWebsite: "https://umslathletics.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "William Jewell College", city: "Liberty", state: "MO", athleticsWebsite: "https://jewellcardinals.com", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },

  // --- D2 Pennsylvania State Athletic Conference (PSAC) --------------------
  { universityName: "Bloomsburg University", city: "Bloomsburg", state: "PA", athleticsWebsite: "https://buhuskies.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "California University of Pennsylvania", city: "California", state: "PA", athleticsWebsite: "https://calupgoldenbears.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "East Stroudsburg University", city: "East Stroudsburg", state: "PA", athleticsWebsite: "https://esuwarriors.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Edinboro University", city: "Edinboro", state: "PA", athleticsWebsite: "https://goboroscots.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Gannon University", city: "Erie", state: "PA", athleticsWebsite: "https://gannonsports.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Indiana University of Pennsylvania", city: "Indiana", state: "PA", athleticsWebsite: "https://iupathletics.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Kutztown University", city: "Kutztown", state: "PA", athleticsWebsite: "https://kugoldenbears.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Millersville University", city: "Millersville", state: "PA", athleticsWebsite: "https://millersvilleathletics.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "University of Pittsburgh at Johnstown", city: "Johnstown", state: "PA", athleticsWebsite: "https://upjathletics.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Seton Hill University", city: "Greensburg", state: "PA", athleticsWebsite: "https://setonhillgriffins.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Shippensburg University", city: "Shippensburg", state: "PA", athleticsWebsite: "https://shipraiders.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Slippery Rock University", city: "Slippery Rock", state: "PA", athleticsWebsite: "https://rockathletics.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "West Chester University", city: "West Chester", state: "PA", athleticsWebsite: "https://wcupagoldenrams.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },

  // --- D2 Sunshine State Conference (SSC) ----------------------------------
  { universityName: "Barry University", city: "Miami Shores", state: "FL", athleticsWebsite: "https://barrybucs.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Eckerd College", city: "Saint Petersburg", state: "FL", athleticsWebsite: "https://goeckerd.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Embry-Riddle Aeronautical University", city: "Daytona Beach", state: "FL", athleticsWebsite: "https://erauathletics.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Florida Southern College", city: "Lakeland", state: "FL", athleticsWebsite: "https://fscmocs.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Lynn University", city: "Boca Raton", state: "FL", athleticsWebsite: "https://lynnfightingknights.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Nova Southeastern University", city: "Davie", state: "FL", athleticsWebsite: "https://nsusharks.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Palm Beach Atlantic University", city: "West Palm Beach", state: "FL", athleticsWebsite: "https://pbasailfish.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Rollins College", city: "Winter Park", state: "FL", athleticsWebsite: "https://rollinssports.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Saint Leo University", city: "Saint Leo", state: "FL", athleticsWebsite: "https://saintleolions.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "University of Tampa", city: "Tampa", state: "FL", athleticsWebsite: "https://tampaspartans.com", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },

  // --- D2 Rocky Mountain Athletic Conference (RMAC) ------------------------
  { universityName: "Adams State University", city: "Alamosa", state: "CO", athleticsWebsite: "https://asugrizzlies.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado Christian University", city: "Lakewood", state: "CO", athleticsWebsite: "https://gococs.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado Mesa University", city: "Grand Junction", state: "CO", athleticsWebsite: "https://cmumavericks.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado State University Pueblo", city: "Pueblo", state: "CO", athleticsWebsite: "https://gothunderwolves.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Metropolitan State University of Denver", city: "Denver", state: "CO", athleticsWebsite: "https://msudenverathletics.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "New Mexico Highlands University", city: "Las Vegas", state: "NM", athleticsWebsite: "https://nmhulighting.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Regis University", city: "Denver", state: "CO", athleticsWebsite: "https://regisrangers.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "University of Colorado Colorado Springs", city: "Colorado Springs", state: "CO", athleticsWebsite: "https://uccsathletics.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Western Colorado University", city: "Gunnison", state: "CO", athleticsWebsite: "https://westerncomountaineers.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },

  // --- D2 South Atlantic Conference (SAC) ----------------------------------
  { universityName: "Anderson University South Carolina", city: "Anderson", state: "SC", athleticsWebsite: "https://athletics.andersonuniversity.edu", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Carson-Newman University", city: "Jefferson City", state: "TN", athleticsWebsite: "https://cneagles.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Catawba College", city: "Salisbury", state: "NC", athleticsWebsite: "https://catawbaindians.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Coker University", city: "Hartsville", state: "SC", athleticsWebsite: "https://gocokercobras.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Emory & Henry College", city: "Emory", state: "VA", athleticsWebsite: "https://ehwasps.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Lenoir-Rhyne University", city: "Hickory", state: "NC", athleticsWebsite: "https://lrbears.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Limestone University", city: "Gaffney", state: "SC", athleticsWebsite: "https://limestonesaints.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Lincoln Memorial University", city: "Harrogate", state: "TN", athleticsWebsite: "https://lmurailsplitters.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Mars Hill University", city: "Mars Hill", state: "NC", athleticsWebsite: "https://mhulions.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Newberry College", city: "Newberry", state: "SC", athleticsWebsite: "https://goncwolves.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Tusculum University", city: "Tusculum", state: "TN", athleticsWebsite: "https://tusculumathletics.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Wingate University", city: "Wingate", state: "NC", athleticsWebsite: "https://wingatebulldogs.com", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },

  // --- D2 California Collegiate Athletic Association (CCAA) ---------------
  { universityName: "California State University, Chico", city: "Chico", state: "CA", athleticsWebsite: "https://chicowildcats.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, Dominguez Hills", city: "Carson", state: "CA", athleticsWebsite: "https://gotoros.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, East Bay", city: "Hayward", state: "CA", athleticsWebsite: "https://gopioneers.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, Los Angeles", city: "Los Angeles", state: "CA", athleticsWebsite: "https://golagoldeneagles.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, Monterey Bay", city: "Seaside", state: "CA", athleticsWebsite: "https://gootters.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, San Bernardino", city: "San Bernardino", state: "CA", athleticsWebsite: "https://csusbathletics.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, San Marcos", city: "San Marcos", state: "CA", athleticsWebsite: "https://gocsusm.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, Stanislaus", city: "Turlock", state: "CA", athleticsWebsite: "https://gostanstate.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "Cal Poly Humboldt", city: "Arcata", state: "CA", athleticsWebsite: "https://humboldtjacks.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "Cal Poly Pomona", city: "Pomona", state: "CA", athleticsWebsite: "https://broncoathletics.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "Sonoma State University", city: "Rohnert Park", state: "CA", athleticsWebsite: "https://sonomaseawolves.com", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },

  // --- D2 Great Northwest Athletic Conference (GNAC) -----------------------
  { universityName: "Northwest Nazarene University", city: "Nampa", state: "ID", athleticsWebsite: "https://nnucrusaders.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Saint Martin's University", city: "Lacey", state: "WA", athleticsWebsite: "https://saintmartinssaints.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Seattle Pacific University", city: "Seattle", state: "WA", athleticsWebsite: "https://gospu.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Simon Fraser University", city: "Burnaby", state: "BC", athleticsWebsite: "https://sfuathletics.ca", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Western Washington University", city: "Bellingham", state: "WA", athleticsWebsite: "https://wwuvikings.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Western Oregon University", city: "Monmouth", state: "OR", athleticsWebsite: "https://wouwolves.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },

  // --- D3 NESCAC -----------------------------------------------------------
  { universityName: "Amherst College", city: "Amherst", state: "MA", athleticsWebsite: "https://amherstmammoths.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Bates College", city: "Lewiston", state: "ME", athleticsWebsite: "https://gobatesbobcats.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Bowdoin College", city: "Brunswick", state: "ME", athleticsWebsite: "https://athletics.bowdoin.edu", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Colby College", city: "Waterville", state: "ME", athleticsWebsite: "https://gocolbymules.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Connecticut College", city: "New London", state: "CT", athleticsWebsite: "https://camelathletics.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Hamilton College", city: "Clinton", state: "NY", athleticsWebsite: "https://athletics.hamilton.edu", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Middlebury College", city: "Middlebury", state: "VT", athleticsWebsite: "https://athletics.middlebury.edu", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Trinity College Connecticut", city: "Hartford", state: "CT", athleticsWebsite: "https://bantamsports.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Tufts University", city: "Medford", state: "MA", athleticsWebsite: "https://gotuftsjumbos.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Wesleyan University", city: "Middletown", state: "CT", athleticsWebsite: "https://wesleyancardinals.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Williams College", city: "Williamstown", state: "MA", athleticsWebsite: "https://ephsports.williams.edu", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },

  // --- D3 Centennial Conference --------------------------------------------
  { universityName: "Dickinson College", city: "Carlisle", state: "PA", athleticsWebsite: "https://dickinsonreddevils.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Franklin & Marshall College", city: "Lancaster", state: "PA", athleticsWebsite: "https://godiplomats.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Gettysburg College", city: "Gettysburg", state: "PA", athleticsWebsite: "https://gettysburgsports.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Haverford College", city: "Haverford", state: "PA", athleticsWebsite: "https://haverfordathletics.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Johns Hopkins University", city: "Baltimore", state: "MD", athleticsWebsite: "https://hopkinssports.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "McDaniel College", city: "Westminster", state: "MD", athleticsWebsite: "https://mcdanielathletics.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Muhlenberg College", city: "Allentown", state: "PA", athleticsWebsite: "https://muhlenbergsports.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Swarthmore College", city: "Swarthmore", state: "PA", athleticsWebsite: "https://swarthmoreathletics.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Susquehanna University", city: "Selinsgrove", state: "PA", athleticsWebsite: "https://gocrusaders.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Ursinus College", city: "Collegeville", state: "PA", athleticsWebsite: "https://ursinusathletics.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Washington College", city: "Chestertown", state: "MD", athleticsWebsite: "https://washingtoncollegesports.com", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },

  // --- D3 Southern California Intercollegiate Athletic Conference (SCIAC) -
  { universityName: "California Institute of Technology", city: "Pasadena", state: "CA", athleticsWebsite: "https://gocaltech.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Chapman University", city: "Orange", state: "CA", athleticsWebsite: "https://chapmanathletics.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Claremont-Mudd-Scripps", city: "Claremont", state: "CA", athleticsWebsite: "https://cmsathletics.org", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "University of La Verne", city: "La Verne", state: "CA", athleticsWebsite: "https://goleopards.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Occidental College", city: "Los Angeles", state: "CA", athleticsWebsite: "https://oxyathletics.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Pomona-Pitzer", city: "Claremont", state: "CA", athleticsWebsite: "https://sagehens.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "University of Redlands", city: "Redlands", state: "CA", athleticsWebsite: "https://redlandsathletics.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Whittier College", city: "Whittier", state: "CA", athleticsWebsite: "https://gopoets.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },

  // --- D3 New Jersey Athletic Conference (NJAC) ----------------------------
  { universityName: "New Jersey City University", city: "Jersey City", state: "NJ", athleticsWebsite: "https://gothicknights.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Ramapo College", city: "Mahwah", state: "NJ", athleticsWebsite: "https://ramapoathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Rowan University", city: "Glassboro", state: "NJ", athleticsWebsite: "https://rowanathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Rutgers University-Camden", city: "Camden", state: "NJ", athleticsWebsite: "https://camdenathletics.rutgers.edu", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Rutgers University-Newark", city: "Newark", state: "NJ", athleticsWebsite: "https://rutgersnewarkathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Stockton University", city: "Galloway", state: "NJ", athleticsWebsite: "https://stocktonathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Stevens Institute of Technology", city: "Hoboken", state: "NJ", athleticsWebsite: "https://stevensducks.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "The College of New Jersey", city: "Ewing", state: "NJ", athleticsWebsite: "https://tcnjathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Kean University", city: "Union", state: "NJ", athleticsWebsite: "https://keanathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "William Paterson University", city: "Wayne", state: "NJ", athleticsWebsite: "https://wpunjathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },

  // --- D3 Liberty League ---------------------------------------------------
  { universityName: "Bard College", city: "Annandale-on-Hudson", state: "NY", athleticsWebsite: "https://bardathletics.com", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },
  { universityName: "Clarkson University", city: "Potsdam", state: "NY", athleticsWebsite: "https://clarksonathletics.com", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },
  { universityName: "Hobart College", city: "Geneva", state: "NY", athleticsWebsite: "https://hwsathletics.com", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },
  { universityName: "Ithaca College", city: "Ithaca", state: "NY", athleticsWebsite: "https://athletics.ithaca.edu", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },
  { universityName: "Rochester Institute of Technology", city: "Rochester", state: "NY", athleticsWebsite: "https://ritathletics.com", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },
  { universityName: "Rensselaer Polytechnic Institute", city: "Troy", state: "NY", athleticsWebsite: "https://rpiathletics.com", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },
  { universityName: "Skidmore College", city: "Saratoga Springs", state: "NY", athleticsWebsite: "https://skidmoreathletics.com", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },
  { universityName: "St. Lawrence University", city: "Canton", state: "NY", athleticsWebsite: "https://saintsathletics.com", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },
  { universityName: "Union College NY", city: "Schenectady", state: "NY", athleticsWebsite: "https://unionathletics.com", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },
  { universityName: "Vassar College", city: "Poughkeepsie", state: "NY", athleticsWebsite: "https://vassarathletics.com", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty" },

  // --- D3 University Athletic Association (UAA) ----------------------------
  { universityName: "Brandeis University", city: "Waltham", state: "MA", athleticsWebsite: "https://brandeisjudges.com", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Carnegie Mellon University", city: "Pittsburgh", state: "PA", athleticsWebsite: "https://athletics.cmu.edu", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Case Western Reserve University", city: "Cleveland", state: "OH", athleticsWebsite: "https://athletics.case.edu", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Emory University", city: "Atlanta", state: "GA", athleticsWebsite: "https://emoryathletics.com", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "New York University", city: "New York", state: "NY", athleticsWebsite: "https://gonyuathletics.com", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "University of Rochester", city: "Rochester", state: "NY", athleticsWebsite: "https://uofrathletics.com", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "University of Chicago", city: "Chicago", state: "IL", athleticsWebsite: "https://athletics.uchicago.edu", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Washington University in St. Louis", city: "Saint Louis", state: "MO", athleticsWebsite: "https://bearsports.wustl.edu", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },

  // --- D3 Old Dominion Athletic Conference (ODAC) --------------------------
  { universityName: "Bridgewater College", city: "Bridgewater", state: "VA", athleticsWebsite: "https://bceagles.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Eastern Mennonite University", city: "Harrisonburg", state: "VA", athleticsWebsite: "https://emuroyals.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Ferrum College", city: "Ferrum", state: "VA", athleticsWebsite: "https://ferrumpanthers.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Guilford College", city: "Greensboro", state: "NC", athleticsWebsite: "https://guilfordquakers.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Hampden-Sydney College", city: "Hampden Sydney", state: "VA", athleticsWebsite: "https://hsctigers.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "University of Lynchburg", city: "Lynchburg", state: "VA", athleticsWebsite: "https://lynchburgsports.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Randolph-Macon College", city: "Ashland", state: "VA", athleticsWebsite: "https://rmcathletics.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Roanoke College", city: "Salem", state: "VA", athleticsWebsite: "https://roanokemaroons.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Shenandoah University", city: "Winchester", state: "VA", athleticsWebsite: "https://shenandoahhornets.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Virginia Wesleyan University", city: "Virginia Beach", state: "VA", athleticsWebsite: "https://vwumarlins.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Washington and Lee University", city: "Lexington", state: "VA", athleticsWebsite: "https://generalssports.com", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },

  // --- D3 Ohio Athletic Conference (OAC) -----------------------------------
  { universityName: "Baldwin Wallace University", city: "Berea", state: "OH", athleticsWebsite: "https://bwyellowjackets.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Capital University", city: "Bexley", state: "OH", athleticsWebsite: "https://capitalcomets.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Heidelberg University", city: "Tiffin", state: "OH", athleticsWebsite: "https://heidelbergathletics.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "John Carroll University", city: "University Heights", state: "OH", athleticsWebsite: "https://jcusports.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Marietta College", city: "Marietta", state: "OH", athleticsWebsite: "https://gomariettapioneers.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Mount Union University", city: "Alliance", state: "OH", athleticsWebsite: "https://mountunion.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Muskingum University", city: "New Concord", state: "OH", athleticsWebsite: "https://muskiesports.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Ohio Northern University", city: "Ada", state: "OH", athleticsWebsite: "https://onusports.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Otterbein University", city: "Westerville", state: "OH", athleticsWebsite: "https://otterbeincardinals.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Wilmington College Ohio", city: "Wilmington", state: "OH", athleticsWebsite: "https://wcquakers.com", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },

  // --- D3 North Coast Athletic Conference (NCAC) ---------------------------
  { universityName: "Allegheny College", city: "Meadville", state: "PA", athleticsWebsite: "https://alleghenygators.com", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
  { universityName: "Denison University", city: "Granville", state: "OH", athleticsWebsite: "https://denisonbigred.com", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
  { universityName: "DePauw University", city: "Greencastle", state: "IN", athleticsWebsite: "https://depauwtigers.com", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
  { universityName: "Hiram College", city: "Hiram", state: "OH", athleticsWebsite: "https://hiramterriers.com", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
  { universityName: "Kenyon College", city: "Gambier", state: "OH", athleticsWebsite: "https://kenyonathletics.com", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
  { universityName: "Oberlin College", city: "Oberlin", state: "OH", athleticsWebsite: "https://goyeo.com", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
  { universityName: "Ohio Wesleyan University", city: "Delaware", state: "OH", athleticsWebsite: "https://battlingbishops.com", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
  { universityName: "Wabash College", city: "Crawfordsville", state: "IN", athleticsWebsite: "https://sports.wabash.edu", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
  { universityName: "Wittenberg University", city: "Springfield", state: "OH", athleticsWebsite: "https://wittenbergtigers.com", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
  { universityName: "The College of Wooster", city: "Wooster", state: "OH", athleticsWebsite: "https://woosterathletics.com", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },
];

interface SeedStats {
  universitiesCreated: number;
  universitiesReused: number;
  programsCreated: number;
  programsSkipped: number;
  errors: { school: string; message: string }[];
}

async function findOrCreateUniversity(seed: MSocSeed): Promise<{ id: string; created: boolean }> {
  const slug = normalizeSlug(seed.universityName);

  const existing = await prisma.university.findFirst({
    where: {
      OR: [{ name: seed.universityName }, slug ? { slug } : undefined].filter(
        (x): x is { name: string } | { slug: string } => Boolean(x)
      ),
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await prisma.university.create({
    data: {
      name: seed.universityName,
      slug: slug ?? undefined,
      city: seed.city ?? null,
      state: seed.state ?? null,
      country: "USA",
      level: seed.level,
      conference: seed.conference,
      websiteUrl: seed.websiteUrl ?? null,
      athleticsWebsite: seed.athleticsWebsite ?? null,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

async function findOrCreateMensSoccerProgram(
  universityId: string,
  seed: MSocSeed
): Promise<{ created: boolean }> {
  const existing = await prisma.school.findUnique({
    where: { universityId_sport: { universityId, sport: SPORT } },
    select: { id: true },
  });
  if (existing) return { created: false };

  await prisma.school.create({
    data: {
      universityId,
      sport: SPORT,
      division: seed.level,
      conference: seed.conference,
      athleticsUrl: seed.athleticsWebsite ?? null,
    },
  });
  return { created: true };
}

async function main() {
  console.log(`⚽  Seeding ${MSOC_PROGRAMS.length} expanded Men's Soccer programs…\n`);

  const stats: SeedStats = {
    universitiesCreated: 0,
    universitiesReused: 0,
    programsCreated: 0,
    programsSkipped: 0,
    errors: [],
  };

  for (const seed of MSOC_PROGRAMS) {
    try {
      const u = await findOrCreateUniversity(seed);
      stats[u.created ? "universitiesCreated" : "universitiesReused"]++;
      const p = await findOrCreateMensSoccerProgram(u.id, seed);
      stats[p.created ? "programsCreated" : "programsSkipped"]++;
      const action = p.created ? "✅ created" : "⏭️  skipped";
      console.log(`${action} [${seed.tierLabel}] ${seed.universityName} — ${seed.conference}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stats.errors.push({ school: seed.universityName, message });
      console.error(`❌  ${seed.universityName}: ${message}`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Universities created:    ${stats.universitiesCreated}`);
  console.log(`Universities reused:     ${stats.universitiesReused}`);
  console.log(`Men's Soccer created:    ${stats.programsCreated}`);
  console.log(`Men's Soccer skipped:    ${stats.programsSkipped} (already existed)`);
  console.log(`Errors: ${stats.errors.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
