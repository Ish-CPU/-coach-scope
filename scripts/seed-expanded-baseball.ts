/**
 * Seed expanded Baseball coverage across every NCAA / NAIA / NJCAA tier.
 *
 * Conservative + idempotent (same contract as seed-major-football-programs.ts,
 * seed-major-womens-soccer-programs.ts, and seed-expanded-mens-soccer.ts):
 *   - University rows that already exist (matched by exact name OR slug) are
 *     reused — never overwritten.
 *   - Baseball School rows that already exist for that university are skipped —
 *     we never create a duplicate (universityId, "Baseball").
 *   - Coaches are NOT created here. Attach verified coaches via the CSV
 *     importer once the head coach is confirmed by name + source URL.
 *
 * Sport: "Baseball" (Men).
 *
 * Notes specific to baseball:
 *   - Not every D1 school fields baseball. Notable D1 schools intentionally
 *     EXCLUDED because they do not sponsor varsity baseball:
 *       Big Ten: Wisconsin
 *       ACC: Syracuse
 *       Patriot League: American (dropped baseball)
 *     If you add a P4 school here, double-check its athletics site lists
 *     baseball before merging.
 *   - Mountain West only carries a small subset of baseball-fielding members.
 *   - The Big West, MVC, Big West, SoCon and other mid-major conferences
 *     sponsor baseball even when their football alignment differs.
 *
 * Usage:
 *   npm run seed:baseball-expanded
 *
 * Add new schools at the bottom of BASEBALL_PROGRAMS — keep grouped by tier
 * and conference so the diff stays reviewable.
 */
import { PrismaClient, Division } from "@prisma/client";
import { normalizeSlug } from "../src/lib/normalize";

const prisma = new PrismaClient();

const SPORT = "Baseball";

interface BaseballSeed {
  universityName: string;
  city?: string;
  state?: string;
  websiteUrl?: string;
  athleticsWebsite?: string;
  level: Division;          // university-level division
  conference: string;       // baseball conference
  tierLabel: string;        // console-output tag only
}

// ---------------------------------------------------------------------------
// Real, currently-active Baseball programs only. Do not invent.
// Each addition must be verifiable against an official athletics website or
// NCAA/NAIA/NJCAA conference page.
// ---------------------------------------------------------------------------
const BASEBALL_PROGRAMS: BaseballSeed[] = [
  // --- D1 SEC --------------------------------------------------------------
  { universityName: "University of Alabama", city: "Tuscaloosa", state: "AL", athleticsWebsite: "https://rolltide.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Arkansas", city: "Fayetteville", state: "AR", athleticsWebsite: "https://arkansasrazorbacks.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Auburn University", city: "Auburn", state: "AL", athleticsWebsite: "https://auburntigers.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Florida", city: "Gainesville", state: "FL", athleticsWebsite: "https://floridagators.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Georgia", city: "Athens", state: "GA", athleticsWebsite: "https://georgiadogs.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Kentucky", city: "Lexington", state: "KY", athleticsWebsite: "https://ukathletics.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Louisiana State University", city: "Baton Rouge", state: "LA", athleticsWebsite: "https://lsusports.net", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Mississippi", city: "Oxford", state: "MS", athleticsWebsite: "https://olemisssports.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Mississippi State University", city: "Starkville", state: "MS", athleticsWebsite: "https://hailstate.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Missouri", city: "Columbia", state: "MO", athleticsWebsite: "https://mutigers.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Oklahoma", city: "Norman", state: "OK", athleticsWebsite: "https://soonersports.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of South Carolina", city: "Columbia", state: "SC", athleticsWebsite: "https://gamecocksonline.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Tennessee", city: "Knoxville", state: "TN", athleticsWebsite: "https://utsports.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Texas A&M University", city: "College Station", state: "TX", athleticsWebsite: "https://12thman.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Texas at Austin", city: "Austin", state: "TX", athleticsWebsite: "https://texassports.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Vanderbilt University", city: "Nashville", state: "TN", athleticsWebsite: "https://vucommodores.com", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },

  // --- D1 ACC (Syracuse excluded — no varsity baseball) -------------------
  { universityName: "Boston College", city: "Chestnut Hill", state: "MA", athleticsWebsite: "https://bceagles.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of California, Berkeley", city: "Berkeley", state: "CA", athleticsWebsite: "https://calbears.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Clemson University", city: "Clemson", state: "SC", athleticsWebsite: "https://clemsontigers.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Duke University", city: "Durham", state: "NC", athleticsWebsite: "https://goduke.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Florida State University", city: "Tallahassee", state: "FL", athleticsWebsite: "https://seminoles.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Georgia Institute of Technology", city: "Atlanta", state: "GA", athleticsWebsite: "https://ramblinwreck.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Louisville", city: "Louisville", state: "KY", athleticsWebsite: "https://gocards.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Miami", city: "Coral Gables", state: "FL", athleticsWebsite: "https://miamihurricanes.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of North Carolina at Chapel Hill", city: "Chapel Hill", state: "NC", athleticsWebsite: "https://goheels.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "North Carolina State University", city: "Raleigh", state: "NC", athleticsWebsite: "https://gopack.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Notre Dame", city: "Notre Dame", state: "IN", athleticsWebsite: "https://fightingirish.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Pittsburgh", city: "Pittsburgh", state: "PA", athleticsWebsite: "https://pittsburghpanthers.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Southern Methodist University", city: "Dallas", state: "TX", athleticsWebsite: "https://smumustangs.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Stanford University", city: "Stanford", state: "CA", athleticsWebsite: "https://gostanford.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Virginia", city: "Charlottesville", state: "VA", athleticsWebsite: "https://virginiasports.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Virginia Tech", city: "Blacksburg", state: "VA", athleticsWebsite: "https://hokiesports.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Wake Forest University", city: "Winston-Salem", state: "NC", athleticsWebsite: "https://godeacs.com", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },

  // --- D1 Big 12 -----------------------------------------------------------
  { universityName: "University of Arizona", city: "Tucson", state: "AZ", athleticsWebsite: "https://arizonawildcats.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Arizona State University", city: "Tempe", state: "AZ", athleticsWebsite: "https://thesundevils.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Baylor University", city: "Waco", state: "TX", athleticsWebsite: "https://baylorbears.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Brigham Young University", city: "Provo", state: "UT", athleticsWebsite: "https://byucougars.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Cincinnati", city: "Cincinnati", state: "OH", athleticsWebsite: "https://gobearcats.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Houston", city: "Houston", state: "TX", athleticsWebsite: "https://uhcougars.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Kansas State University", city: "Manhattan", state: "KS", athleticsWebsite: "https://kstatesports.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Kansas", city: "Lawrence", state: "KS", athleticsWebsite: "https://kuathletics.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Oklahoma State University", city: "Stillwater", state: "OK", athleticsWebsite: "https://okstate.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Texas Christian University", city: "Fort Worth", state: "TX", athleticsWebsite: "https://gofrogs.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Texas Tech University", city: "Lubbock", state: "TX", athleticsWebsite: "https://texastech.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Central Florida", city: "Orlando", state: "FL", athleticsWebsite: "https://ucfknights.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Utah", city: "Salt Lake City", state: "UT", athleticsWebsite: "https://utahutes.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "West Virginia University", city: "Morgantown", state: "WV", athleticsWebsite: "https://wvusports.com", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },

  // --- D1 Big Ten (Wisconsin excluded — no varsity baseball) --------------
  { universityName: "University of Illinois", city: "Champaign", state: "IL", athleticsWebsite: "https://fightingillini.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Indiana University", city: "Bloomington", state: "IN", athleticsWebsite: "https://iuhoosiers.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Iowa", city: "Iowa City", state: "IA", athleticsWebsite: "https://hawkeyesports.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Maryland", city: "College Park", state: "MD", athleticsWebsite: "https://umterps.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Michigan", city: "Ann Arbor", state: "MI", athleticsWebsite: "https://mgoblue.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Michigan State University", city: "East Lansing", state: "MI", athleticsWebsite: "https://msuspartans.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Minnesota", city: "Minneapolis", state: "MN", athleticsWebsite: "https://gophersports.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Nebraska", city: "Lincoln", state: "NE", athleticsWebsite: "https://huskers.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Northwestern University", city: "Evanston", state: "IL", athleticsWebsite: "https://nusports.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Ohio State University", city: "Columbus", state: "OH", athleticsWebsite: "https://ohiostatebuckeyes.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Oregon", city: "Eugene", state: "OR", athleticsWebsite: "https://goducks.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Penn State University", city: "University Park", state: "PA", athleticsWebsite: "https://gopsusports.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Purdue University", city: "West Lafayette", state: "IN", athleticsWebsite: "https://purduesports.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Rutgers University-New Brunswick", city: "New Brunswick", state: "NJ", athleticsWebsite: "https://scarletknights.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "UCLA", city: "Los Angeles", state: "CA", athleticsWebsite: "https://uclabruins.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Southern California", city: "Los Angeles", state: "CA", athleticsWebsite: "https://usctrojans.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Washington", city: "Seattle", state: "WA", athleticsWebsite: "https://gohuskies.com", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },

  // --- D1 Pac-12 (post-realignment baseball: WSU + OSU) -------------------
  { universityName: "Oregon State University", city: "Corvallis", state: "OR", athleticsWebsite: "https://osubeavers.com", level: Division.D1, conference: "Pac-12", tierLabel: "D1 / Pac-12" },
  { universityName: "Washington State University", city: "Pullman", state: "WA", athleticsWebsite: "https://wsucougars.com", level: Division.D1, conference: "Pac-12", tierLabel: "D1 / Pac-12" },

  // --- D1 American Athletic Conference (AAC) -------------------------------
  { universityName: "University of North Carolina at Charlotte", city: "Charlotte", state: "NC", athleticsWebsite: "https://charlotte49ers.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "East Carolina University", city: "Greenville", state: "NC", athleticsWebsite: "https://ecupirates.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Florida Atlantic University", city: "Boca Raton", state: "FL", athleticsWebsite: "https://fausports.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Memphis", city: "Memphis", state: "TN", athleticsWebsite: "https://gotigersgo.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of North Texas", city: "Denton", state: "TX", athleticsWebsite: "https://meangreensports.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Rice University", city: "Houston", state: "TX", athleticsWebsite: "https://riceowls.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of South Florida", city: "Tampa", state: "FL", athleticsWebsite: "https://gousfbulls.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Tulane University", city: "New Orleans", state: "LA", athleticsWebsite: "https://tulanegreenwave.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Alabama at Birmingham", city: "Birmingham", state: "AL", athleticsWebsite: "https://uabsports.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Texas at San Antonio", city: "San Antonio", state: "TX", athleticsWebsite: "https://goutsa.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Wichita State University", city: "Wichita", state: "KS", athleticsWebsite: "https://goshockers.com", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },

  // --- D1 Sun Belt ---------------------------------------------------------
  { universityName: "Appalachian State University", city: "Boone", state: "NC", athleticsWebsite: "https://appstatesports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Arkansas State University", city: "Jonesboro", state: "AR", athleticsWebsite: "https://astateredwolves.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Coastal Carolina University", city: "Conway", state: "SC", athleticsWebsite: "https://goccusports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Georgia Southern University", city: "Statesboro", state: "GA", athleticsWebsite: "https://gseagles.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Georgia State University", city: "Atlanta", state: "GA", athleticsWebsite: "https://georgiastatesports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "James Madison University", city: "Harrisonburg", state: "VA", athleticsWebsite: "https://jmusports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of Louisiana at Lafayette", city: "Lafayette", state: "LA", athleticsWebsite: "https://ragincajuns.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of Louisiana at Monroe", city: "Monroe", state: "LA", athleticsWebsite: "https://warhawksports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Marshall University", city: "Huntington", state: "WV", athleticsWebsite: "https://herdzone.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Old Dominion University", city: "Norfolk", state: "VA", athleticsWebsite: "https://odusports.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of South Alabama", city: "Mobile", state: "AL", athleticsWebsite: "https://usajaguars.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of Southern Mississippi", city: "Hattiesburg", state: "MS", athleticsWebsite: "https://southernmiss.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Texas State University", city: "San Marcos", state: "TX", athleticsWebsite: "https://txstatebobcats.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Troy University", city: "Troy", state: "AL", athleticsWebsite: "https://troytrojans.com", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },

  // --- D1 Conference USA ---------------------------------------------------
  { universityName: "Florida International University", city: "Miami", state: "FL", athleticsWebsite: "https://fiusports.com", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Jacksonville State University", city: "Jacksonville", state: "AL", athleticsWebsite: "https://jaxstatesports.com", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Liberty University", city: "Lynchburg", state: "VA", athleticsWebsite: "https://libertyflames.com", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Louisiana Tech University", city: "Ruston", state: "LA", athleticsWebsite: "https://latechsports.com", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Middle Tennessee State University", city: "Murfreesboro", state: "TN", athleticsWebsite: "https://goblueraiders.com", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Sam Houston State University", city: "Huntsville", state: "TX", athleticsWebsite: "https://gobearkats.com", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "University of Texas at El Paso", city: "El Paso", state: "TX", athleticsWebsite: "https://utepathletics.com", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Western Kentucky University", city: "Bowling Green", state: "KY", athleticsWebsite: "https://wkusports.com", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },

  // --- D1 Big West ---------------------------------------------------------
  { universityName: "University of California, Davis", city: "Davis", state: "CA", athleticsWebsite: "https://ucdavisaggies.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of California, Irvine", city: "Irvine", state: "CA", athleticsWebsite: "https://ucirvinesports.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of California, Riverside", city: "Riverside", state: "CA", athleticsWebsite: "https://gohighlanders.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of California, San Diego", city: "La Jolla", state: "CA", athleticsWebsite: "https://ucsdtritons.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of California, Santa Barbara", city: "Santa Barbara", state: "CA", athleticsWebsite: "https://ucsbgauchos.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "California Polytechnic State University", city: "San Luis Obispo", state: "CA", athleticsWebsite: "https://gopoly.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "California State University, Bakersfield", city: "Bakersfield", state: "CA", athleticsWebsite: "https://gorunners.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "California State University, Fullerton", city: "Fullerton", state: "CA", athleticsWebsite: "https://fullertontitans.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "California State University, Long Beach", city: "Long Beach", state: "CA", athleticsWebsite: "https://longbeachstate.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "California State University, Northridge", city: "Northridge", state: "CA", athleticsWebsite: "https://gomatadors.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of Hawaii at Manoa", city: "Honolulu", state: "HI", athleticsWebsite: "https://hawaiiathletics.com", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },

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
  { universityName: "University of Evansville", city: "Evansville", state: "IN", athleticsWebsite: "https://gopurpleaces.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Illinois State University", city: "Normal", state: "IL", athleticsWebsite: "https://goredbirds.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Indiana State University", city: "Terre Haute", state: "IN", athleticsWebsite: "https://gosycamores.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Missouri State University", city: "Springfield", state: "MO", athleticsWebsite: "https://missouristatebears.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Murray State University", city: "Murray", state: "KY", athleticsWebsite: "https://goracers.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Southern Illinois University", city: "Carbondale", state: "IL", athleticsWebsite: "https://siusalukis.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Valparaiso University", city: "Valparaiso", state: "IN", athleticsWebsite: "https://valpoathletics.com", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },

  // --- D1 Atlantic 10 (A-10) -----------------------------------------------
  { universityName: "Davidson College", city: "Davidson", state: "NC", athleticsWebsite: "https://davidsonwildcats.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "University of Dayton", city: "Dayton", state: "OH", athleticsWebsite: "https://daytonflyers.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Fordham University", city: "Bronx", state: "NY", athleticsWebsite: "https://fordhamsports.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "George Mason University", city: "Fairfax", state: "VA", athleticsWebsite: "https://gomason.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "George Washington University", city: "Washington", state: "DC", athleticsWebsite: "https://gwsports.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "La Salle University", city: "Philadelphia", state: "PA", athleticsWebsite: "https://goexplorers.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "University of Massachusetts", city: "Amherst", state: "MA", athleticsWebsite: "https://umassathletics.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "University of Rhode Island", city: "Kingston", state: "RI", athleticsWebsite: "https://gorhody.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "University of Richmond", city: "Richmond", state: "VA", athleticsWebsite: "https://richmondspiders.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Saint Joseph's University", city: "Philadelphia", state: "PA", athleticsWebsite: "https://sjuhawks.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Saint Louis University", city: "Saint Louis", state: "MO", athleticsWebsite: "https://slubillikens.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "St. Bonaventure University", city: "Saint Bonaventure", state: "NY", athleticsWebsite: "https://gobonnies.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Virginia Commonwealth University", city: "Richmond", state: "VA", athleticsWebsite: "https://vcuathletics.com", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },

  // --- D1 Ivy League -------------------------------------------------------
  { universityName: "Brown University", city: "Providence", state: "RI", athleticsWebsite: "https://brownbears.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Columbia University", city: "New York", state: "NY", athleticsWebsite: "https://gocolumbialions.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Cornell University", city: "Ithaca", state: "NY", athleticsWebsite: "https://cornellbigred.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Dartmouth College", city: "Hanover", state: "NH", athleticsWebsite: "https://dartmouthsports.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Harvard University", city: "Cambridge", state: "MA", athleticsWebsite: "https://gocrimson.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "University of Pennsylvania", city: "Philadelphia", state: "PA", athleticsWebsite: "https://pennathletics.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Princeton University", city: "Princeton", state: "NJ", athleticsWebsite: "https://goprincetontigers.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Yale University", city: "New Haven", state: "CT", athleticsWebsite: "https://yalebulldogs.com", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },

  // --- D1 Patriot League (American excluded — no varsity baseball) --------
  { universityName: "Army West Point", city: "West Point", state: "NY", athleticsWebsite: "https://goarmywestpoint.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Boston University", city: "Boston", state: "MA", athleticsWebsite: "https://goterriers.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Bucknell University", city: "Lewisburg", state: "PA", athleticsWebsite: "https://bucknellbison.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "College of the Holy Cross", city: "Worcester", state: "MA", athleticsWebsite: "https://goholycross.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Lafayette College", city: "Easton", state: "PA", athleticsWebsite: "https://goleopards.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Lehigh University", city: "Bethlehem", state: "PA", athleticsWebsite: "https://lehighsports.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Loyola University Maryland", city: "Baltimore", state: "MD", athleticsWebsite: "https://loyolagreyhounds.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "United States Naval Academy", city: "Annapolis", state: "MD", athleticsWebsite: "https://navysports.com", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },

  // --- D1 Mid-American Conference (MAC) ------------------------------------
  { universityName: "University of Akron", city: "Akron", state: "OH", athleticsWebsite: "https://gozips.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Ball State University", city: "Muncie", state: "IN", athleticsWebsite: "https://ballstatesports.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Bowling Green State University", city: "Bowling Green", state: "OH", athleticsWebsite: "https://bgsufalcons.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Central Michigan University", city: "Mount Pleasant", state: "MI", athleticsWebsite: "https://cmuchippewas.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Eastern Michigan University", city: "Ypsilanti", state: "MI", athleticsWebsite: "https://emueagles.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Kent State University", city: "Kent", state: "OH", athleticsWebsite: "https://kentstatesports.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Miami University Ohio", city: "Oxford", state: "OH", athleticsWebsite: "https://miamiredhawks.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Northern Illinois University", city: "DeKalb", state: "IL", athleticsWebsite: "https://niuhuskies.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Ohio University", city: "Athens", state: "OH", athleticsWebsite: "https://ohiobobcats.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "University of Toledo", city: "Toledo", state: "OH", athleticsWebsite: "https://utrockets.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Western Michigan University", city: "Kalamazoo", state: "MI", athleticsWebsite: "https://wmubroncos.com", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },

  // --- D1 Southern Conference (SoCon) --------------------------------------
  { universityName: "The Citadel", city: "Charleston", state: "SC", athleticsWebsite: "https://citadelsports.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "East Tennessee State University", city: "Johnson City", state: "TN", athleticsWebsite: "https://etsubucs.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Furman University", city: "Greenville", state: "SC", athleticsWebsite: "https://furmanpaladins.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Mercer University", city: "Macon", state: "GA", athleticsWebsite: "https://mercerbears.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "University of North Carolina at Greensboro", city: "Greensboro", state: "NC", athleticsWebsite: "https://uncgspartans.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Samford University", city: "Birmingham", state: "AL", athleticsWebsite: "https://samfordsports.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "University of Tennessee at Chattanooga", city: "Chattanooga", state: "TN", athleticsWebsite: "https://gomocs.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Virginia Military Institute", city: "Lexington", state: "VA", athleticsWebsite: "https://vmikeydets.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Western Carolina University", city: "Cullowhee", state: "NC", athleticsWebsite: "https://catamountsports.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Wofford College", city: "Spartanburg", state: "SC", athleticsWebsite: "https://woffordterriers.com", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },

  // --- D1 Southland Conference ---------------------------------------------
  { universityName: "East Texas A&M University", city: "Commerce", state: "TX", athleticsWebsite: "https://lionathletics.com", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Houston Christian University", city: "Houston", state: "TX", athleticsWebsite: "https://hcuhuskies.com", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "University of the Incarnate Word", city: "San Antonio", state: "TX", athleticsWebsite: "https://uiwcardinals.com", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Lamar University", city: "Beaumont", state: "TX", athleticsWebsite: "https://lamarcardinals.com", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "McNeese State University", city: "Lake Charles", state: "LA", athleticsWebsite: "https://mcneesesports.com", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "University of New Orleans", city: "New Orleans", state: "LA", athleticsWebsite: "https://privateersathletics.com", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Nicholls State University", city: "Thibodaux", state: "LA", athleticsWebsite: "https://geauxcolonels.com", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Northwestern State University", city: "Natchitoches", state: "LA", athleticsWebsite: "https://nsudemons.com", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Southeastern Louisiana University", city: "Hammond", state: "LA", athleticsWebsite: "https://lionsports.net", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Texas A&M University-Corpus Christi", city: "Corpus Christi", state: "TX", athleticsWebsite: "https://goislanders.com", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },

  // --- D1 ASUN Conference --------------------------------------------------
  { universityName: "Bellarmine University", city: "Louisville", state: "KY", athleticsWebsite: "https://athletics.bellarmine.edu", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Central Arkansas University", city: "Conway", state: "AR", athleticsWebsite: "https://ucasports.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Eastern Kentucky University", city: "Richmond", state: "KY", athleticsWebsite: "https://ekusports.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Florida Gulf Coast University", city: "Fort Myers", state: "FL", athleticsWebsite: "https://fgcuathletics.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Jacksonville University", city: "Jacksonville", state: "FL", athleticsWebsite: "https://judolphins.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Lipscomb University", city: "Nashville", state: "TN", athleticsWebsite: "https://lipscombsports.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "University of North Alabama", city: "Florence", state: "AL", athleticsWebsite: "https://roarlions.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "University of North Florida", city: "Jacksonville", state: "FL", athleticsWebsite: "https://unfospreys.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Queens University of Charlotte", city: "Charlotte", state: "NC", athleticsWebsite: "https://queensathletics.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Stetson University", city: "DeLand", state: "FL", athleticsWebsite: "https://gohatters.com", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },

  // --- D1 Northeast Conference (NEC) ---------------------------------------
  { universityName: "Central Connecticut State University", city: "New Britain", state: "CT", athleticsWebsite: "https://ccsubluedevils.com", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Fairleigh Dickinson University", city: "Teaneck", state: "NJ", athleticsWebsite: "https://fduknights.com", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Le Moyne College", city: "Syracuse", state: "NY", athleticsWebsite: "https://lemoynedolphins.com", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Long Island University", city: "Brookville", state: "NY", athleticsWebsite: "https://liusharks.com", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Mercyhurst University", city: "Erie", state: "PA", athleticsWebsite: "https://hurstathletics.com", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Saint Francis University", city: "Loretto", state: "PA", athleticsWebsite: "https://sfuathletics.com", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Stonehill College", city: "Easton", state: "MA", athleticsWebsite: "https://gostonehill.com", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Wagner College", city: "Staten Island", state: "NY", athleticsWebsite: "https://wagnerathletics.com", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },

  // --- D1 Horizon League ---------------------------------------------------
  { universityName: "Northern Kentucky University", city: "Highland Heights", state: "KY", athleticsWebsite: "https://nkunorse.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Oakland University", city: "Rochester", state: "MI", athleticsWebsite: "https://goldengrizzlies.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Purdue University Fort Wayne", city: "Fort Wayne", state: "IN", athleticsWebsite: "https://gomastodons.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Wright State University", city: "Dayton", state: "OH", athleticsWebsite: "https://wsuraiders.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Youngstown State University", city: "Youngstown", state: "OH", athleticsWebsite: "https://ysusports.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "University of Wisconsin-Milwaukee", city: "Milwaukee", state: "WI", athleticsWebsite: "https://mkepanthers.com", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },

  // --- D1 Summit League ----------------------------------------------------
  { universityName: "University of North Dakota", city: "Grand Forks", state: "ND", athleticsWebsite: "https://fightinghawks.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "North Dakota State University", city: "Fargo", state: "ND", athleticsWebsite: "https://gobison.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "University of South Dakota", city: "Vermillion", state: "SD", athleticsWebsite: "https://goyotes.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "South Dakota State University", city: "Brookings", state: "SD", athleticsWebsite: "https://gojacks.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "University of Nebraska Omaha", city: "Omaha", state: "NE", athleticsWebsite: "https://omavs.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "Oral Roberts University", city: "Tulsa", state: "OK", athleticsWebsite: "https://oruathletics.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "St. Thomas University Minnesota", city: "Saint Paul", state: "MN", athleticsWebsite: "https://tommiesports.com", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },

  // --- D2 Lone Star Conference ---------------------------------------------
  { universityName: "Angelo State University", city: "San Angelo", state: "TX", athleticsWebsite: "https://angelosports.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Cameron University", city: "Lawton", state: "OK", athleticsWebsite: "https://camerongoaggies.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Lubbock Christian University", city: "Lubbock", state: "TX", athleticsWebsite: "https://lcuchaps.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Midwestern State University", city: "Wichita Falls", state: "TX", athleticsWebsite: "https://msumustangs.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Oklahoma Christian University", city: "Edmond", state: "OK", athleticsWebsite: "https://eaglesathletics.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "St. Edward's University", city: "Austin", state: "TX", athleticsWebsite: "https://sehilltoppers.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "St. Mary's University Texas", city: "San Antonio", state: "TX", athleticsWebsite: "https://stmuathletics.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Texas A&M University-Kingsville", city: "Kingsville", state: "TX", athleticsWebsite: "https://javelinaathletics.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Eastern New Mexico University", city: "Portales", state: "NM", athleticsWebsite: "https://goeasternathletics.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Western New Mexico University", city: "Silver City", state: "NM", athleticsWebsite: "https://godustdevils.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "University of Texas Permian Basin", city: "Odessa", state: "TX", athleticsWebsite: "https://utpbfalcons.com", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },

  // --- D2 PSAC -------------------------------------------------------------
  { universityName: "Bloomsburg University", city: "Bloomsburg", state: "PA", athleticsWebsite: "https://buhuskies.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "California University of Pennsylvania", city: "California", state: "PA", athleticsWebsite: "https://calupgoldenbears.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "East Stroudsburg University", city: "East Stroudsburg", state: "PA", athleticsWebsite: "https://esuwarriors.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Gannon University", city: "Erie", state: "PA", athleticsWebsite: "https://gannonsports.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Indiana University of Pennsylvania", city: "Indiana", state: "PA", athleticsWebsite: "https://iupathletics.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Kutztown University", city: "Kutztown", state: "PA", athleticsWebsite: "https://kugoldenbears.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Lock Haven University", city: "Lock Haven", state: "PA", athleticsWebsite: "https://lhuathletics.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Mansfield University", city: "Mansfield", state: "PA", athleticsWebsite: "https://gomounties.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Millersville University", city: "Millersville", state: "PA", athleticsWebsite: "https://millersvilleathletics.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "University of Pittsburgh at Johnstown", city: "Johnstown", state: "PA", athleticsWebsite: "https://upjathletics.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Seton Hill University", city: "Greensburg", state: "PA", athleticsWebsite: "https://setonhillgriffins.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Shepherd University", city: "Shepherdstown", state: "WV", athleticsWebsite: "https://rams.shepherd.edu", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Shippensburg University", city: "Shippensburg", state: "PA", athleticsWebsite: "https://shipraiders.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Slippery Rock University", city: "Slippery Rock", state: "PA", athleticsWebsite: "https://rockathletics.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "West Chester University", city: "West Chester", state: "PA", athleticsWebsite: "https://wcupagoldenrams.com", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },

  // --- D2 GLVC -------------------------------------------------------------
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

  // --- D2 RMAC -------------------------------------------------------------
  { universityName: "Adams State University", city: "Alamosa", state: "CO", athleticsWebsite: "https://asugrizzlies.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado Christian University", city: "Lakewood", state: "CO", athleticsWebsite: "https://gococs.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado Mesa University", city: "Grand Junction", state: "CO", athleticsWebsite: "https://cmumavericks.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado School of Mines", city: "Golden", state: "CO", athleticsWebsite: "https://csmorediggers.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado State University Pueblo", city: "Pueblo", state: "CO", athleticsWebsite: "https://gothunderwolves.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Metropolitan State University of Denver", city: "Denver", state: "CO", athleticsWebsite: "https://msudenverathletics.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "New Mexico Highlands University", city: "Las Vegas", state: "NM", athleticsWebsite: "https://nmhulighting.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Regis University", city: "Denver", state: "CO", athleticsWebsite: "https://regisrangers.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "University of Colorado Colorado Springs", city: "Colorado Springs", state: "CO", athleticsWebsite: "https://uccsathletics.com", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },

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

  // --- D2 Gulf South Conference --------------------------------------------
  { universityName: "Alabama-Huntsville", city: "Huntsville", state: "AL", athleticsWebsite: "https://uahchargers.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Auburn University at Montgomery", city: "Montgomery", state: "AL", athleticsWebsite: "https://aumwarhawks.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Christian Brothers University", city: "Memphis", state: "TN", athleticsWebsite: "https://cbubuccaneers.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Delta State University", city: "Cleveland", state: "MS", athleticsWebsite: "https://gostatesmen.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Lee University", city: "Cleveland", state: "TN", athleticsWebsite: "https://leeuflames.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Mississippi College", city: "Clinton", state: "MS", athleticsWebsite: "https://gochoctaws.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "University of Montevallo", city: "Montevallo", state: "AL", athleticsWebsite: "https://montevallofalcons.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Trevecca Nazarene University", city: "Nashville", state: "TN", athleticsWebsite: "https://trevecca-athletics.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Union University Tennessee", city: "Jackson", state: "TN", athleticsWebsite: "https://uubulldogs.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Valdosta State University", city: "Valdosta", state: "GA", athleticsWebsite: "https://vstateblazers.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "University of West Alabama", city: "Livingston", state: "AL", athleticsWebsite: "https://uwatigers.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "University of West Florida", city: "Pensacola", state: "FL", athleticsWebsite: "https://goargos.com", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },

  // --- D2 CCAA -------------------------------------------------------------
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

  // --- D2 GNAC -------------------------------------------------------------
  { universityName: "Northwest Nazarene University", city: "Nampa", state: "ID", athleticsWebsite: "https://nnucrusaders.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Saint Martin's University", city: "Lacey", state: "WA", athleticsWebsite: "https://saintmartinssaints.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Western Oregon University", city: "Monmouth", state: "OR", athleticsWebsite: "https://wouwolves.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Central Washington University", city: "Ellensburg", state: "WA", athleticsWebsite: "https://wildcatsports.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Concordia University Portland", city: "Portland", state: "OR", athleticsWebsite: "https://cuportland.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },
  { universityName: "Western Washington University", city: "Bellingham", state: "WA", athleticsWebsite: "https://wwuvikings.com", level: Division.D2, conference: "GNAC", tierLabel: "D2 / GNAC" },

  // --- D2 NSIC -------------------------------------------------------------
  { universityName: "Augustana University South Dakota", city: "Sioux Falls", state: "SD", athleticsWebsite: "https://goaugie.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Bemidji State University", city: "Bemidji", state: "MN", athleticsWebsite: "https://bsubeavers.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Concordia University Saint Paul", city: "Saint Paul", state: "MN", athleticsWebsite: "https://cspbears.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Minnesota Duluth", city: "Duluth", state: "MN", athleticsWebsite: "https://umdbulldogs.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Minnesota State University Mankato", city: "Mankato", state: "MN", athleticsWebsite: "https://msumavericks.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Minnesota State University Moorhead", city: "Moorhead", state: "MN", athleticsWebsite: "https://gomsumdragons.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Minot State University", city: "Minot", state: "ND", athleticsWebsite: "https://minotstateathletics.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Northern State University", city: "Aberdeen", state: "SD", athleticsWebsite: "https://northernwolves.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Saint Cloud State University", city: "Saint Cloud", state: "MN", athleticsWebsite: "https://scsuhuskies.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Southwest Minnesota State University", city: "Marshall", state: "MN", athleticsWebsite: "https://smsumustangs.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "University of Mary", city: "Bismarck", state: "ND", athleticsWebsite: "https://umarymarauders.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Wayne State College", city: "Wayne", state: "NE", athleticsWebsite: "https://wscwildcats.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Winona State University", city: "Winona", state: "MN", athleticsWebsite: "https://winonastatewarriors.com", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },

  // --- D3 NESCAC -----------------------------------------------------------
  { universityName: "Amherst College", city: "Amherst", state: "MA", athleticsWebsite: "https://amherstmammoths.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Bates College", city: "Lewiston", state: "ME", athleticsWebsite: "https://gobatesbobcats.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Bowdoin College", city: "Brunswick", state: "ME", athleticsWebsite: "https://athletics.bowdoin.edu", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Colby College", city: "Waterville", state: "ME", athleticsWebsite: "https://gocolbymules.com", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
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

  // --- D3 SCIAC ------------------------------------------------------------
  { universityName: "California Institute of Technology", city: "Pasadena", state: "CA", athleticsWebsite: "https://gocaltech.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Chapman University", city: "Orange", state: "CA", athleticsWebsite: "https://chapmanathletics.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Claremont-Mudd-Scripps", city: "Claremont", state: "CA", athleticsWebsite: "https://cmsathletics.org", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "University of La Verne", city: "La Verne", state: "CA", athleticsWebsite: "https://goleopards.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Occidental College", city: "Los Angeles", state: "CA", athleticsWebsite: "https://oxyathletics.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Pomona-Pitzer", city: "Claremont", state: "CA", athleticsWebsite: "https://sagehens.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "University of Redlands", city: "Redlands", state: "CA", athleticsWebsite: "https://redlandsathletics.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },
  { universityName: "Whittier College", city: "Whittier", state: "CA", athleticsWebsite: "https://gopoets.com", level: Division.D3, conference: "SCIAC", tierLabel: "D3 / SCIAC" },

  // --- D3 NJAC -------------------------------------------------------------
  { universityName: "Kean University", city: "Union", state: "NJ", athleticsWebsite: "https://keanathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "New Jersey City University", city: "Jersey City", state: "NJ", athleticsWebsite: "https://gothicknights.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Ramapo College", city: "Mahwah", state: "NJ", athleticsWebsite: "https://ramapoathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Rowan University", city: "Glassboro", state: "NJ", athleticsWebsite: "https://rowanathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Rutgers University-Camden", city: "Camden", state: "NJ", athleticsWebsite: "https://camdenathletics.rutgers.edu", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Rutgers University-Newark", city: "Newark", state: "NJ", athleticsWebsite: "https://rutgersnewarkathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Stockton University", city: "Galloway", state: "NJ", athleticsWebsite: "https://stocktonathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Stevens Institute of Technology", city: "Hoboken", state: "NJ", athleticsWebsite: "https://stevensducks.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "The College of New Jersey", city: "Ewing", state: "NJ", athleticsWebsite: "https://tcnjathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "William Paterson University", city: "Wayne", state: "NJ", athleticsWebsite: "https://wpunjathletics.com", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },

  // --- D3 OAC --------------------------------------------------------------
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

  // --- D3 NCAC -------------------------------------------------------------
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

  // --- D3 UAA --------------------------------------------------------------
  { universityName: "Brandeis University", city: "Waltham", state: "MA", athleticsWebsite: "https://brandeisjudges.com", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Carnegie Mellon University", city: "Pittsburgh", state: "PA", athleticsWebsite: "https://athletics.cmu.edu", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Case Western Reserve University", city: "Cleveland", state: "OH", athleticsWebsite: "https://athletics.case.edu", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Emory University", city: "Atlanta", state: "GA", athleticsWebsite: "https://emoryathletics.com", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "University of Rochester", city: "Rochester", state: "NY", athleticsWebsite: "https://uofrathletics.com", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Washington University in St. Louis", city: "Saint Louis", state: "MO", athleticsWebsite: "https://bearsports.wustl.edu", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },

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

  // --- D3 ODAC -------------------------------------------------------------
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

  // --- NAIA Heart of America Athletic Conference ---------------------------
  { universityName: "Baker University", city: "Baldwin City", state: "KS", athleticsWebsite: "https://bakerwildcats.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Benedictine College", city: "Atchison", state: "KS", athleticsWebsite: "https://benedictineravens.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Central Methodist University", city: "Fayette", state: "MO", athleticsWebsite: "https://gocmuathletics.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Clarke University", city: "Dubuque", state: "IA", athleticsWebsite: "https://clarkepride.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Culver-Stockton College", city: "Canton", state: "MO", athleticsWebsite: "https://csctigers.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Evangel University", city: "Springfield", state: "MO", athleticsWebsite: "https://evangelcrusaders.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Grand View University", city: "Des Moines", state: "IA", athleticsWebsite: "https://gvuvikings.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Graceland University", city: "Lamoni", state: "IA", athleticsWebsite: "https://gracelandyellowjackets.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "MidAmerica Nazarene University", city: "Olathe", state: "KS", athleticsWebsite: "https://munpioneers.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Missouri Valley College", city: "Marshall", state: "MO", athleticsWebsite: "https://movikings.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Mount Mercy University", city: "Cedar Rapids", state: "IA", athleticsWebsite: "https://mountmercymustangs.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Peru State College", city: "Peru", state: "NE", athleticsWebsite: "https://perustatebobcats.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "William Penn University", city: "Oskaloosa", state: "IA", athleticsWebsite: "https://wmpenn.com", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },

  // --- NAIA KCAC -----------------------------------------------------------
  { universityName: "Bethany College Kansas", city: "Lindsborg", state: "KS", athleticsWebsite: "https://bcswedes.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Bethel College Kansas", city: "North Newton", state: "KS", athleticsWebsite: "https://bethelthreshers.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Friends University", city: "Wichita", state: "KS", athleticsWebsite: "https://friendsathletics.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Kansas Wesleyan University", city: "Salina", state: "KS", athleticsWebsite: "https://kwucoyotes.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "McPherson College", city: "McPherson", state: "KS", athleticsWebsite: "https://mcphersonbulldogs.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Oklahoma Wesleyan University", city: "Bartlesville", state: "OK", athleticsWebsite: "https://okwueagles.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Ottawa University", city: "Ottawa", state: "KS", athleticsWebsite: "https://ottawabraves.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Southwestern College Kansas", city: "Winfield", state: "KS", athleticsWebsite: "https://swcmoundbuilders.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Sterling College", city: "Sterling", state: "KS", athleticsWebsite: "https://sterlingathletics.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Tabor College", city: "Hillsboro", state: "KS", athleticsWebsite: "https://taborbluejays.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "University of Saint Mary", city: "Leavenworth", state: "KS", athleticsWebsite: "https://spirescougars.com", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },

  // --- NAIA GPAC -----------------------------------------------------------
  { universityName: "Briar Cliff University", city: "Sioux City", state: "IA", athleticsWebsite: "https://bcuchargers.com", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Concordia University Nebraska", city: "Seward", state: "NE", athleticsWebsite: "https://cuneathletics.com", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Dakota Wesleyan University", city: "Mitchell", state: "SD", athleticsWebsite: "https://dwutigers.com", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Doane University", city: "Crete", state: "NE", athleticsWebsite: "https://doanetigers.com", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Dordt University", city: "Sioux Center", state: "IA", athleticsWebsite: "https://dordtdefenders.com", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Hastings College", city: "Hastings", state: "NE", athleticsWebsite: "https://hastingsbroncos.com", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Midland University", city: "Fremont", state: "NE", athleticsWebsite: "https://midlandwarriors.com", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Morningside University", city: "Sioux City", state: "IA", athleticsWebsite: "https://morningside.edu/athletics", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Mount Marty University", city: "Yankton", state: "SD", athleticsWebsite: "https://mountmartysports.com", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Northwestern College Iowa", city: "Orange City", state: "IA", athleticsWebsite: "https://nwcredraiders.com", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },

  // --- NAIA Mid-South Conference -------------------------------------------
  { universityName: "Bethel University Tennessee", city: "McKenzie", state: "TN", athleticsWebsite: "https://bethelwildcats.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Blue Mountain Christian University", city: "Blue Mountain", state: "MS", athleticsWebsite: "https://gobmctoppers.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Campbellsville University", city: "Campbellsville", state: "KY", athleticsWebsite: "https://campbellsvilletigers.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Cumberland University", city: "Lebanon", state: "TN", athleticsWebsite: "https://gocumberland.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "University of the Cumberlands", city: "Williamsburg", state: "KY", athleticsWebsite: "https://ucpatriots.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Freed-Hardeman University", city: "Henderson", state: "TN", athleticsWebsite: "https://fhulions.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Georgetown College", city: "Georgetown", state: "KY", athleticsWebsite: "https://georgetowncollegetigers.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Kentucky Christian University", city: "Grayson", state: "KY", athleticsWebsite: "https://kcuknights.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Lindsey Wilson College", city: "Columbia", state: "KY", athleticsWebsite: "https://lwcbluesraiders.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Life University", city: "Marietta", state: "GA", athleticsWebsite: "https://liferunningeagles.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Pikeville University", city: "Pikeville", state: "KY", athleticsWebsite: "https://upikeathletics.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Shawnee State University", city: "Portsmouth", state: "OH", athleticsWebsite: "https://shawneestatebears.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Thomas More University", city: "Crestview Hills", state: "KY", athleticsWebsite: "https://thomasmoresaints.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Tennessee Wesleyan University", city: "Athens", state: "TN", athleticsWebsite: "https://twubulldogs.com", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },

  // --- NAIA Sun Conference -------------------------------------------------
  { universityName: "Ave Maria University", city: "Ave Maria", state: "FL", athleticsWebsite: "https://avemariagyrenes.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Coastal Georgia", city: "Brunswick", state: "GA", athleticsWebsite: "https://ccgamariners.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Florida College", city: "Temple Terrace", state: "FL", athleticsWebsite: "https://flcfalcons.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Florida Memorial University", city: "Miami Gardens", state: "FL", athleticsWebsite: "https://fmulions.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Keiser University", city: "West Palm Beach", state: "FL", athleticsWebsite: "https://keiserseahawks.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "St. Thomas University", city: "Miami Gardens", state: "FL", athleticsWebsite: "https://stubobcats.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Southeastern University", city: "Lakeland", state: "FL", athleticsWebsite: "https://sefire.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Thomas University", city: "Thomasville", state: "GA", athleticsWebsite: "https://thomasunightclubs.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Warner University", city: "Lake Wales", state: "FL", athleticsWebsite: "https://warnerroyals.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Webber International University", city: "Babson Park", state: "FL", athleticsWebsite: "https://webberwarriors.com", level: Division.NAIA, conference: "Sun Conference", tierLabel: "NAIA / Sun" },

  // --- NJCAA Region 8 (Florida) --------------------------------------------
  { universityName: "Chipola College", city: "Marianna", state: "FL", athleticsWebsite: "https://chipolaindians.com", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / R8" },
  { universityName: "College of Central Florida", city: "Ocala", state: "FL", athleticsWebsite: "https://goccfpatriots.com", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / R8" },
  { universityName: "Pasco-Hernando State College", city: "New Port Richey", state: "FL", athleticsWebsite: "https://phsccobras.com", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / R8" },
  { universityName: "Polk State College", city: "Winter Haven", state: "FL", athleticsWebsite: "https://polk.edu/athletics", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / R8" },
  { universityName: "Santa Fe College", city: "Gainesville", state: "FL", athleticsWebsite: "https://sfsaints.com", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / R8" },
  { universityName: "St. Petersburg College", city: "Saint Petersburg", state: "FL", athleticsWebsite: "https://spcathletics.com", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / R8" },
  { universityName: "Daytona State College", city: "Daytona Beach", state: "FL", athleticsWebsite: "https://daytonastatefalcons.com", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / R8" },
  { universityName: "South Florida State College", city: "Avon Park", state: "FL", athleticsWebsite: "https://southfloridapanthers.com", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / R8" },
  { universityName: "State College of Florida Manatee-Sarasota", city: "Bradenton", state: "FL", athleticsWebsite: "https://scfmanatees.com", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / R8" },

  // --- NJCAA Region 16 (Missouri/Iowa belt) -------------------------------
  { universityName: "Crowder College", city: "Neosho", state: "MO", athleticsWebsite: "https://crowderathletics.com", level: Division.NJCAA, conference: "NJCAA Region 16", tierLabel: "JUCO / R16" },
  { universityName: "Iowa Western Community College", city: "Council Bluffs", state: "IA", athleticsWebsite: "https://reivers.iwcc.edu", level: Division.NJCAA, conference: "NJCAA Region 16", tierLabel: "JUCO / R16" },
  { universityName: "Indian Hills Community College", city: "Ottumwa", state: "IA", athleticsWebsite: "https://ihccwarriors.com", level: Division.NJCAA, conference: "NJCAA Region 16", tierLabel: "JUCO / R16" },
  { universityName: "Kirkwood Community College", city: "Cedar Rapids", state: "IA", athleticsWebsite: "https://kirkwoodeagles.com", level: Division.NJCAA, conference: "NJCAA Region 16", tierLabel: "JUCO / R16" },
  { universityName: "Iowa Central Community College", city: "Fort Dodge", state: "IA", athleticsWebsite: "https://goiowacentral.com", level: Division.NJCAA, conference: "NJCAA Region 16", tierLabel: "JUCO / R16" },
  { universityName: "Southwestern Iowa Community College", city: "Creston", state: "IA", athleticsWebsite: "https://swccspartans.com", level: Division.NJCAA, conference: "NJCAA Region 16", tierLabel: "JUCO / R16" },
  { universityName: "Mineral Area College", city: "Park Hills", state: "MO", athleticsWebsite: "https://mineralareacardinals.com", level: Division.NJCAA, conference: "NJCAA Region 16", tierLabel: "JUCO / R16" },
  { universityName: "Three Rivers College", city: "Poplar Bluff", state: "MO", athleticsWebsite: "https://trcraiders.com", level: Division.NJCAA, conference: "NJCAA Region 16", tierLabel: "JUCO / R16" },

  // --- NJCAA Region 2 (Oklahoma) -------------------------------------------
  { universityName: "Eastern Oklahoma State College", city: "Wilburton", state: "OK", athleticsWebsite: "https://gomountaineerathletics.com", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / R2" },
  { universityName: "Murray State College", city: "Tishomingo", state: "OK", athleticsWebsite: "https://murraystateaggies.com", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / R2" },
  { universityName: "Northeastern Oklahoma A&M College", city: "Miami", state: "OK", athleticsWebsite: "https://neogoldennorse.com", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / R2" },
  { universityName: "Connors State College", city: "Warner", state: "OK", athleticsWebsite: "https://connorsstatecowboys.com", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / R2" },
  { universityName: "Seminole State College", city: "Seminole", state: "OK", athleticsWebsite: "https://ssctrojans.com", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / R2" },
  { universityName: "Carl Albert State College", city: "Poteau", state: "OK", athleticsWebsite: "https://carlalbertvikings.com", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / R2" },
  { universityName: "Rose State College", city: "Midwest City", state: "OK", athleticsWebsite: "https://rosestateraiders.com", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / R2" },
  { universityName: "Redlands Community College", city: "El Reno", state: "OK", athleticsWebsite: "https://redlandscougars.com", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / R2" },
  { universityName: "Western Oklahoma State College", city: "Altus", state: "OK", athleticsWebsite: "https://wosc.edu/athletics", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / R2" },

  // --- JUCO CCCAA (California) ---------------------------------------------
  { universityName: "Mt. San Antonio College", city: "Walnut", state: "CA", athleticsWebsite: "https://mtsacathletics.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Riverside City College", city: "Riverside", state: "CA", athleticsWebsite: "https://rcctigers.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Fullerton College", city: "Fullerton", state: "CA", athleticsWebsite: "https://fchornets.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Pasadena City College", city: "Pasadena", state: "CA", athleticsWebsite: "https://gopcclancers.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Saddleback College", city: "Mission Viejo", state: "CA", athleticsWebsite: "https://saddlebackgauchos.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Palomar College", city: "San Marcos", state: "CA", athleticsWebsite: "https://palomarathletics.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Orange Coast College", city: "Costa Mesa", state: "CA", athleticsWebsite: "https://orangecoastsports.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Sierra College", city: "Rocklin", state: "CA", athleticsWebsite: "https://sierracollegeathletics.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Citrus College", city: "Glendora", state: "CA", athleticsWebsite: "https://citruscollegeathletics.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Long Beach City College", city: "Long Beach", state: "CA", athleticsWebsite: "https://lbccvikings.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Bakersfield College", city: "Bakersfield", state: "CA", athleticsWebsite: "https://bcrenegades.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Cypress College", city: "Cypress", state: "CA", athleticsWebsite: "https://cypresscollege.edu/athletics", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "San Joaquin Delta College", city: "Stockton", state: "CA", athleticsWebsite: "https://deltamustangs.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Santa Rosa Junior College", city: "Santa Rosa", state: "CA", athleticsWebsite: "https://santarosabearcubs.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Cuesta College", city: "San Luis Obispo", state: "CA", athleticsWebsite: "https://cuestacougars.com", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
];

interface SeedStats {
  universitiesCreated: number;
  universitiesReused: number;
  programsCreated: number;
  programsSkipped: number;
  errors: { school: string; message: string }[];
}

async function findOrCreateUniversity(seed: BaseballSeed): Promise<{ id: string; created: boolean }> {
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

async function findOrCreateBaseballProgram(
  universityId: string,
  seed: BaseballSeed
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
  console.log(`⚾  Seeding ${BASEBALL_PROGRAMS.length} expanded Baseball programs…\n`);

  const stats: SeedStats = {
    universitiesCreated: 0,
    universitiesReused: 0,
    programsCreated: 0,
    programsSkipped: 0,
    errors: [],
  };

  for (const seed of BASEBALL_PROGRAMS) {
    try {
      const u = await findOrCreateUniversity(seed);
      stats[u.created ? "universitiesCreated" : "universitiesReused"]++;
      const p = await findOrCreateBaseballProgram(u.id, seed);
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
  console.log(`Baseball created:        ${stats.programsCreated}`);
  console.log(`Baseball skipped:        ${stats.programsSkipped} (already existed)`);
  console.log(`Errors: ${stats.errors.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
