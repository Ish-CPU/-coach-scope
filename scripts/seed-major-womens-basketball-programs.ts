/**
 * Seed major Women's Basketball programs across every NCAA / NAIA / NJCAA tier.
 *
 * Conservative + idempotent (same contract as seed-major-football-programs.ts):
 *   - University rows that already exist (matched by exact name OR slug) are
 *     reused — never overwritten.
 *   - Women's Basketball School rows that already exist for that university
 *     are skipped — we never create a duplicate (universityId, "Women's Basketball").
 *   - Coaches are NOT created here. Attach verified coaches via the CSV
 *     importer once the head coach is confirmed by name + source URL.
 *
 * Sport: "Women's Basketball" (Women). Use the CSV importer for other sports.
 *
 * Usage:
 *   npm run seed:womens-basketball-major
 *
 * Add new schools at the bottom of WBB_PROGRAMS — keep them grouped by
 * tier and conference so the diff stays reviewable.
 */
import { PrismaClient, Division } from "@prisma/client";
import { normalizeSlug } from "../src/lib/normalize";

const prisma = new PrismaClient();

const SPORT = "Women's Basketball";

interface WBBSeed {
  universityName: string;
  city?: string;
  state?: string;
  websiteUrl?: string;
  athleticsWebsite?: string;
  level: Division;          // university-level division
  conference: string;       // women's basketball conference
  tierLabel: string;        // console-output tag only
}

// ---------------------------------------------------------------------------
// Real, currently-active Women's Basketball programs only. Do not invent.
// Each addition must be verifiable against an official athletics website or
// NCAA/NAIA/NJCAA conference page. WBB conferences sometimes differ from a
// school's football conference (e.g. UConn is football Independent but WBB Big East).
// ---------------------------------------------------------------------------
const WBB_PROGRAMS: WBBSeed[] = [
  // --- D1 SEC --------------------------------------------------------------
  { universityName: "University of Alabama", state: "AL", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Auburn University", state: "AL", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Arkansas", state: "AR", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Florida", state: "FL", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Georgia", state: "GA", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Kentucky", state: "KY", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Louisiana State University", state: "LA", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Mississippi", state: "MS", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Mississippi State University", state: "MS", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Missouri", state: "MO", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Oklahoma", state: "OK", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of South Carolina", state: "SC", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Tennessee", state: "TN", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Texas A&M University", state: "TX", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Texas at Austin", state: "TX", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Vanderbilt University", state: "TN", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },

  // --- D1 Big Ten ----------------------------------------------------------
  { universityName: "Indiana University", state: "IN", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Illinois", state: "IL", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Iowa", state: "IA", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Maryland", state: "MD", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Michigan", state: "MI", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Michigan State University", state: "MI", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Minnesota", state: "MN", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Nebraska", state: "NE", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Northwestern University", state: "IL", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Ohio State University", state: "OH", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Oregon", state: "OR", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Penn State University", state: "PA", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Purdue University", state: "IN", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Rutgers University-New Brunswick", state: "NJ", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "UCLA", state: "CA", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Southern California", state: "CA", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Washington", state: "WA", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "University of Wisconsin-Madison", state: "WI", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },

  // --- D1 ACC --------------------------------------------------------------
  { universityName: "Boston College", state: "MA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Clemson University", state: "SC", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Duke University", state: "NC", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Florida State University", state: "FL", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Louisville", state: "KY", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Miami", state: "FL", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of North Carolina at Chapel Hill", state: "NC", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "North Carolina State University", state: "NC", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Notre Dame", state: "IN", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Pittsburgh", state: "PA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Stanford University", state: "CA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Southern Methodist University", state: "TX", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Syracuse University", state: "NY", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },

  // --- D1 Big 12 -----------------------------------------------------------
  { universityName: "University of Arizona", state: "AZ", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Arizona State University", state: "AZ", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Baylor University", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Brigham Young University", state: "UT", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Cincinnati", state: "OH", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Colorado", state: "CO", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Houston", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Iowa State University", state: "IA", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Kansas", state: "KS", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Kansas State University", state: "KS", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Oklahoma State University", state: "OK", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Texas Tech University", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Central Florida", state: "FL", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Utah", state: "UT", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "West Virginia University", state: "WV", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },

  // --- D1 Big East ---------------------------------------------------------
  { universityName: "University of Connecticut", state: "CT", level: Division.D1, conference: "Big East", tierLabel: "D1 / Big East" },
  { universityName: "Villanova University", state: "PA", level: Division.D1, conference: "Big East", tierLabel: "D1 / Big East" },
  { universityName: "Butler University", state: "IN", level: Division.D1, conference: "Big East", tierLabel: "D1 / Big East" },

  // --- D1 American Athletic Conference -------------------------------------
  { universityName: "University of Memphis", state: "TN", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Tulane University", state: "LA", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Temple University", state: "PA", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of South Florida", state: "FL", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Alabama at Birmingham", state: "AL", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Tulsa", state: "OK", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Rice University", state: "TX", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Texas at San Antonio", state: "TX", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Florida Atlantic University", state: "FL", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "East Carolina University", state: "NC", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },

  // --- D1 Atlantic 10 ------------------------------------------------------
  { universityName: "University of Richmond", state: "VA", level: Division.D1, conference: "Atlantic 10", tierLabel: "D1 / A-10" },
  { universityName: "Davidson College", state: "NC", level: Division.D1, conference: "Atlantic 10", tierLabel: "D1 / A-10" },
  { universityName: "University of Dayton", state: "OH", level: Division.D1, conference: "Atlantic 10", tierLabel: "D1 / A-10" },
  { universityName: "Duquesne University", state: "PA", level: Division.D1, conference: "Atlantic 10", tierLabel: "D1 / A-10" },
  { universityName: "University of Massachusetts Amherst", state: "MA", level: Division.D1, conference: "Atlantic 10", tierLabel: "D1 / A-10" },

  // --- D1 Mountain West ----------------------------------------------------
  { universityName: "United States Air Force Academy", state: "CO", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "Boise State University", state: "ID", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "Colorado State University", state: "CO", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "Fresno State University", state: "CA", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "University of Hawaii at Manoa", state: "HI", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "University of Nevada Las Vegas", state: "NV", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "University of Nevada Reno", state: "NV", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "University of New Mexico", state: "NM", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "San Diego State University", state: "CA", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "Utah State University", state: "UT", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },
  { universityName: "University of Wyoming", state: "WY", level: Division.D1, conference: "Mountain West", tierLabel: "D1 / Mountain West" },

  // --- D1 Ivy League -------------------------------------------------------
  { universityName: "Harvard University", state: "MA", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy League" },
  { universityName: "Princeton University", state: "NJ", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy League" },
  { universityName: "Yale University", state: "CT", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy League" },

  // --- D1 Patriot League ---------------------------------------------------
  { universityName: "Lehigh University", state: "PA", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot League" },
  { universityName: "Lafayette College", state: "PA", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot League" },
  { universityName: "College of the Holy Cross", state: "MA", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot League" },
  { universityName: "Colgate University", state: "NY", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot League" },
  { universityName: "United States Military Academy", state: "NY", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot League" },
  { universityName: "United States Naval Academy", state: "MD", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot League" },

  // --- D1 MAC --------------------------------------------------------------
  { universityName: "University of Akron", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Ball State University", state: "IN", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Bowling Green State University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "University at Buffalo", state: "NY", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Kent State University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Miami University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Northern Illinois University", state: "IL", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Ohio University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "University of Toledo", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Western Michigan University", state: "MI", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },

  // --- D1 Sun Belt ---------------------------------------------------------
  { universityName: "Appalachian State University", state: "NC", level: Division.D1, conference: "Sun Belt", tierLabel: "D1 / Sun Belt" },
  { universityName: "Coastal Carolina University", state: "SC", level: Division.D1, conference: "Sun Belt", tierLabel: "D1 / Sun Belt" },
  { universityName: "James Madison University", state: "VA", level: Division.D1, conference: "Sun Belt", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of Louisiana at Lafayette", state: "LA", level: Division.D1, conference: "Sun Belt", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of Louisiana at Monroe", state: "LA", level: Division.D1, conference: "Sun Belt", tierLabel: "D1 / Sun Belt" },
  { universityName: "Marshall University", state: "WV", level: Division.D1, conference: "Sun Belt", tierLabel: "D1 / Sun Belt" },
  { universityName: "Old Dominion University", state: "VA", level: Division.D1, conference: "Sun Belt", tierLabel: "D1 / Sun Belt" },
  { universityName: "Texas State University", state: "TX", level: Division.D1, conference: "Sun Belt", tierLabel: "D1 / Sun Belt" },

  // --- D1 Conference USA ---------------------------------------------------
  { universityName: "Jacksonville State University", state: "AL", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / CUSA" },
  { universityName: "Kennesaw State University", state: "GA", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / CUSA" },
  { universityName: "Liberty University", state: "VA", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / CUSA" },
  { universityName: "Middle Tennessee State University", state: "TN", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / CUSA" },
  { universityName: "New Mexico State University", state: "NM", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / CUSA" },
  { universityName: "Sam Houston State University", state: "TX", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / CUSA" },
  { universityName: "University of Texas at El Paso", state: "TX", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / CUSA" },
  { universityName: "Western Kentucky University", state: "KY", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / CUSA" },
  { universityName: "University of Delaware", state: "DE", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / CUSA" },

  // --- D1 MVC --------------------------------------------------------------
  { universityName: "Drake University", state: "IA", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Indiana State University", state: "IN", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Illinois State University", state: "IL", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Murray State University", state: "KY", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "University of Northern Iowa", state: "IA", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Belmont University", state: "TN", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Valparaiso University", state: "IN", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },

  // --- D1 Summit League ----------------------------------------------------
  { universityName: "North Dakota State University", state: "ND", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "South Dakota State University", state: "SD", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "University of North Dakota", state: "ND", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "University of South Dakota", state: "SD", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },

  // --- D1 Big Sky ----------------------------------------------------------
  { universityName: "Eastern Washington University", state: "WA", level: Division.D1, conference: "Big Sky", tierLabel: "D1 / Big Sky" },
  { universityName: "University of Idaho", state: "ID", level: Division.D1, conference: "Big Sky", tierLabel: "D1 / Big Sky" },
  { universityName: "Idaho State University", state: "ID", level: Division.D1, conference: "Big Sky", tierLabel: "D1 / Big Sky" },
  { universityName: "Northern Arizona University", state: "AZ", level: Division.D1, conference: "Big Sky", tierLabel: "D1 / Big Sky" },
  { universityName: "University of Northern Colorado", state: "CO", level: Division.D1, conference: "Big Sky", tierLabel: "D1 / Big Sky" },
  { universityName: "Portland State University", state: "OR", level: Division.D1, conference: "Big Sky", tierLabel: "D1 / Big Sky" },
  { universityName: "Sacramento State University", state: "CA", level: Division.D1, conference: "Big Sky", tierLabel: "D1 / Big Sky" },
  { universityName: "Weber State University", state: "UT", level: Division.D1, conference: "Big Sky", tierLabel: "D1 / Big Sky" },

  // --- D1 Big West ---------------------------------------------------------
  { universityName: "California Polytechnic State University", state: "CA", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },
  { universityName: "University of California Davis", state: "CA", level: Division.D1, conference: "Big West", tierLabel: "D1 / Big West" },

  // --- D1 SWAC -------------------------------------------------------------
  { universityName: "Alabama A&M University", state: "AL", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Alabama State University", state: "AL", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "University of Arkansas at Pine Bluff", state: "AR", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Bethune-Cookman University", state: "FL", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Florida A&M University", state: "FL", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Grambling State University", state: "LA", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Jackson State University", state: "MS", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Mississippi Valley State University", state: "MS", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Prairie View A&M University", state: "TX", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Southern University", state: "LA", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Texas Southern University", state: "TX", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },

  // --- D1 MEAC -------------------------------------------------------------
  { universityName: "Delaware State University", state: "DE", level: Division.D1, conference: "MEAC", tierLabel: "D1 / MEAC" },
  { universityName: "Howard University", state: "DC", level: Division.D1, conference: "MEAC", tierLabel: "D1 / MEAC" },
  { universityName: "Norfolk State University", state: "VA", level: Division.D1, conference: "MEAC", tierLabel: "D1 / MEAC" },
  { universityName: "North Carolina A&T State University", state: "NC", level: Division.D1, conference: "MEAC", tierLabel: "D1 / MEAC" },
  { universityName: "South Carolina State University", state: "SC", level: Division.D1, conference: "MEAC", tierLabel: "D1 / MEAC" },

  // --- D1 CAA --------------------------------------------------------------
  { universityName: "The College of William and Mary", state: "VA", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Towson University", state: "MD", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Stony Brook University", state: "NY", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Hampton University", state: "VA", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Bryant University", state: "RI", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },

  // --- D1 Southern Conference ---------------------------------------------
  { universityName: "Furman University", state: "SC", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Wofford College", state: "SC", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Mercer University", state: "GA", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },
  { universityName: "Western Carolina University", state: "NC", level: Division.D1, conference: "Southern Conference", tierLabel: "D1 / SoCon" },

  // --- D1 Big South --------------------------------------------------------
  { universityName: "Charleston Southern University", state: "SC", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },
  { universityName: "Gardner-Webb University", state: "NC", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },
  { universityName: "Presbyterian College", state: "SC", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },

  // --- D1 Northeast Conference --------------------------------------------
  { universityName: "Wagner College", state: "NY", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Stonehill College", state: "MA", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Long Island University", state: "NY", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Merrimack College", state: "MA", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Saint Francis University", state: "PA", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },

  // --- D1 ASUN -------------------------------------------------------------
  { universityName: "Eastern Kentucky University", state: "KY", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Austin Peay State University", state: "TN", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Stetson University", state: "FL", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "University of North Alabama", state: "AL", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },

  // --- D1 Ohio Valley Conference ------------------------------------------
  { universityName: "Eastern Illinois University", state: "IL", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Tennessee State University", state: "TN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Tennessee Tech University", state: "TN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "University of Tennessee at Martin", state: "TN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Lindenwood University", state: "MO", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Western Illinois University", state: "IL", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Morehead State University", state: "KY", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },

  // --- D1 Southland --------------------------------------------------------
  { universityName: "McNeese State University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Nicholls State University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Northwestern State University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Southeastern Louisiana University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Lamar University", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Houston Christian University", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "University of the Incarnate Word", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "East Texas A&M University", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },

  // --- D1 WAC --------------------------------------------------------------
  { universityName: "Tarleton State University", state: "TX", level: Division.D1, conference: "WAC", tierLabel: "D1 / WAC" },
  { universityName: "Abilene Christian University", state: "TX", level: Division.D1, conference: "WAC", tierLabel: "D1 / WAC" },
  { universityName: "Southern Utah University", state: "UT", level: Division.D1, conference: "WAC", tierLabel: "D1 / WAC" },

  // --- D1 Horizon ----------------------------------------------------------
  { universityName: "Robert Morris University", state: "PA", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },

  // --- D1 MAAC -------------------------------------------------------------
  { universityName: "Sacred Heart University", state: "CT", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },

  // --- D2 PSAC -------------------------------------------------------------
  { universityName: "Indiana University of Pennsylvania", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Shippensburg University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Kutztown University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "West Chester University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "California University of Pennsylvania", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Millersville University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "East Stroudsburg University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Gannon University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },

  // --- D2 MIAA -------------------------------------------------------------
  { universityName: "Northwest Missouri State University", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "University of Central Missouri", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Missouri Western State University", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Missouri Southern State University", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Emporia State University", state: "KS", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Fort Hays State University", state: "KS", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Washburn University", state: "KS", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "University of Nebraska at Kearney", state: "NE", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },

  // --- D2 NSIC -------------------------------------------------------------
  { universityName: "Minnesota State University Mankato", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Bemidji State University", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Winona State University", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Northern State University", state: "SD", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "University of Sioux Falls", state: "SD", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Saint Cloud State University", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "University of Minnesota Duluth", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Concordia University Saint Paul", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Wayne State College", state: "NE", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },

  // --- D2 GLIAC ------------------------------------------------------------
  { universityName: "Wayne State University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Northern Michigan University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },

  // --- D2 GMAC -------------------------------------------------------------
  { universityName: "Ashland University", state: "OH", level: Division.D2, conference: "G-MAC", tierLabel: "D2 / GMAC" },
  { universityName: "University of Findlay", state: "OH", level: Division.D2, conference: "G-MAC", tierLabel: "D2 / GMAC" },
  { universityName: "Tiffin University", state: "OH", level: Division.D2, conference: "G-MAC", tierLabel: "D2 / GMAC" },
  { universityName: "Walsh University", state: "OH", level: Division.D2, conference: "G-MAC", tierLabel: "D2 / GMAC" },
  { universityName: "Lake Erie College", state: "OH", level: Division.D2, conference: "G-MAC", tierLabel: "D2 / GMAC" },

  // --- D2 GLVC -------------------------------------------------------------
  { universityName: "Truman State University", state: "MO", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },

  // --- D2 Lone Star Conference --------------------------------------------
  { universityName: "Angelo State University", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Midwestern State University", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "University of Texas Permian Basin", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Texas A&M University-Kingsville", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Eastern New Mexico University", state: "NM", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Western New Mexico University", state: "NM", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Western Oregon University", state: "OR", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },

  // --- D2 RMAC -------------------------------------------------------------
  { universityName: "Chadron State College", state: "NE", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Western Colorado University", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Adams State University", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado Mesa University", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Black Hills State University", state: "SD", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "South Dakota School of Mines and Technology", state: "SD", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },

  // --- D2 SAC --------------------------------------------------------------
  { universityName: "Catawba College", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Lincoln Memorial University", state: "TN", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Wingate University", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Carson-Newman University", state: "TN", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Mars Hill University", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Limestone University", state: "SC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Lenoir-Rhyne University", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Newberry College", state: "SC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Tusculum University", state: "TN", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },

  // --- D2 Gulf South ------------------------------------------------------
  { universityName: "Valdosta State University", state: "GA", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / GSC" },
  { universityName: "Mississippi College", state: "MS", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / GSC" },
  { universityName: "Delta State University", state: "MS", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / GSC" },
  { universityName: "University of West Alabama", state: "AL", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / GSC" },
  { universityName: "Spring Hill College", state: "AL", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / GSC" },

  // --- D2 Great American Conference ---------------------------------------
  { universityName: "Henderson State University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Harding University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Ouachita Baptist University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Arkansas Tech University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Southwestern Oklahoma State University", state: "OK", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Southeastern Oklahoma State University", state: "OK", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Northwestern Oklahoma State University", state: "OK", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },

  // --- D2 Mountain East ---------------------------------------------------
  { universityName: "West Virginia State University", state: "WV", level: Division.D2, conference: "Mountain East Conference", tierLabel: "D2 / MEC" },
  { universityName: "Concord University", state: "WV", level: Division.D2, conference: "Mountain East Conference", tierLabel: "D2 / MEC" },
  { universityName: "Glenville State University", state: "WV", level: Division.D2, conference: "Mountain East Conference", tierLabel: "D2 / MEC" },
  { universityName: "Fairmont State University", state: "WV", level: Division.D2, conference: "Mountain East Conference", tierLabel: "D2 / MEC" },
  { universityName: "West Virginia Wesleyan College", state: "WV", level: Division.D2, conference: "Mountain East Conference", tierLabel: "D2 / MEC" },
  { universityName: "University of Charleston", state: "WV", level: Division.D2, conference: "Mountain East Conference", tierLabel: "D2 / MEC" },

  // --- D2 SIAC -------------------------------------------------------------
  { universityName: "Tuskegee University", state: "AL", level: Division.D2, conference: "SIAC", tierLabel: "D2 / SIAC" },
  { universityName: "Albany State University", state: "GA", level: Division.D2, conference: "SIAC", tierLabel: "D2 / SIAC" },
  { universityName: "Fort Valley State University", state: "GA", level: Division.D2, conference: "SIAC", tierLabel: "D2 / SIAC" },

  // --- D2 Conference Carolinas --------------------------------------------
  { universityName: "North Greenville University", state: "SC", level: Division.D2, conference: "Conference Carolinas", tierLabel: "D2 / CC" },

  // --- D2 CCAA -------------------------------------------------------------
  { universityName: "Sonoma State University", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University Chico", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University San Bernardino", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },

  // --- D2 PacWest ----------------------------------------------------------
  { universityName: "Azusa Pacific University", state: "CA", level: Division.D2, conference: "PacWest Conference", tierLabel: "D2 / PacWest" },

  // --- D2 Great Northwest --------------------------------------------------
  { universityName: "Cal Poly Humboldt", state: "CA", level: Division.D2, conference: "Great Northwest Athletic Conference", tierLabel: "D2 / GNAC" },

  // --- D3 NESCAC -----------------------------------------------------------
  { universityName: "Amherst College", state: "MA", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Williams College", state: "MA", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Bowdoin College", state: "ME", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Bates College", state: "ME", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Colby College", state: "ME", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Middlebury College", state: "VT", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Hamilton College", state: "NY", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Trinity College", state: "CT", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Connecticut College", state: "CT", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Tufts University", state: "MA", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Wesleyan University", state: "CT", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },

  // --- D3 Centennial -------------------------------------------------------
  { universityName: "Dickinson College", state: "PA", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Franklin and Marshall College", state: "PA", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Gettysburg College", state: "PA", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Haverford College", state: "PA", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Johns Hopkins University", state: "MD", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "McDaniel College", state: "MD", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Muhlenberg College", state: "PA", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Swarthmore College", state: "PA", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Ursinus College", state: "PA", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },
  { universityName: "Susquehanna University", state: "PA", level: Division.D3, conference: "Centennial Conference", tierLabel: "D3 / Centennial" },

  // --- D3 MIAC -------------------------------------------------------------
  { universityName: "Augsburg University", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3 / MIAC" },
  { universityName: "Carleton College", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3 / MIAC" },
  { universityName: "Gustavus Adolphus College", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3 / MIAC" },
  { universityName: "Macalester College", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3 / MIAC" },
  { universityName: "Saint Olaf College", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3 / MIAC" },
  { universityName: "Bethel University MN", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3 / MIAC" },
  { universityName: "Saint Mary's University of Minnesota", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3 / MIAC" },
  { universityName: "Concordia College", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3 / MIAC" },
  { universityName: "Hamline University", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3 / MIAC" },

  // --- D3 CCIW -------------------------------------------------------------
  { universityName: "Wheaton College", state: "IL", level: Division.D3, conference: "CCIW", tierLabel: "D3 / CCIW" },
  { universityName: "Augustana College", state: "IL", level: Division.D3, conference: "CCIW", tierLabel: "D3 / CCIW" },
  { universityName: "Carthage College", state: "WI", level: Division.D3, conference: "CCIW", tierLabel: "D3 / CCIW" },
  { universityName: "Elmhurst University", state: "IL", level: Division.D3, conference: "CCIW", tierLabel: "D3 / CCIW" },
  { universityName: "Millikin University", state: "IL", level: Division.D3, conference: "CCIW", tierLabel: "D3 / CCIW" },
  { universityName: "North Park University", state: "IL", level: Division.D3, conference: "CCIW", tierLabel: "D3 / CCIW" },

  // --- D3 NCAC -------------------------------------------------------------
  { universityName: "DePauw University", state: "IN", level: Division.D3, conference: "NCAC", tierLabel: "D3 / NCAC" },

  // --- D3 OAC --------------------------------------------------------------
  { universityName: "John Carroll University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Otterbein University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Marietta College", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Capital University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Heidelberg University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Baldwin Wallace University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Ohio Northern University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },

  // --- D3 ODAC -------------------------------------------------------------
  { universityName: "Randolph-Macon College", state: "VA", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Roanoke College", state: "VA", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "University of Lynchburg", state: "VA", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Washington and Lee University", state: "VA", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Bridgewater College", state: "VA", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Shenandoah University", state: "VA", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },
  { universityName: "Guilford College", state: "NC", level: Division.D3, conference: "ODAC", tierLabel: "D3 / ODAC" },

  // --- D3 SAA --------------------------------------------------------------
  { universityName: "Berry College", state: "GA", level: Division.D3, conference: "Southern Athletic Association", tierLabel: "D3 / SAA" },
  { universityName: "Centre College", state: "KY", level: Division.D3, conference: "Southern Athletic Association", tierLabel: "D3 / SAA" },
  { universityName: "Rhodes College", state: "TN", level: Division.D3, conference: "Southern Athletic Association", tierLabel: "D3 / SAA" },
  { universityName: "Trinity University TX", state: "TX", level: Division.D3, conference: "Southern Athletic Association", tierLabel: "D3 / SAA" },
  { universityName: "Sewanee The University of the South", state: "TN", level: Division.D3, conference: "Southern Athletic Association", tierLabel: "D3 / SAA" },
  { universityName: "Hendrix College", state: "AR", level: Division.D3, conference: "Southern Athletic Association", tierLabel: "D3 / SAA" },
  { universityName: "Millsaps College", state: "MS", level: Division.D3, conference: "Southern Athletic Association", tierLabel: "D3 / SAA" },

  // --- D3 NWC --------------------------------------------------------------
  { universityName: "George Fox University", state: "OR", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3 / NWC" },
  { universityName: "Pacific Lutheran University", state: "WA", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3 / NWC" },
  { universityName: "Linfield University", state: "OR", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3 / NWC" },
  { universityName: "Whitworth University", state: "WA", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3 / NWC" },
  { universityName: "Whitman College", state: "WA", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3 / NWC" },
  { universityName: "Lewis and Clark College", state: "OR", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3 / NWC" },
  { universityName: "Pacific University", state: "OR", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3 / NWC" },
  { universityName: "Willamette University", state: "OR", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3 / NWC" },
  { universityName: "University of Puget Sound", state: "WA", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3 / NWC" },

  // --- D3 SCIAC ------------------------------------------------------------
  { universityName: "Pomona-Pitzer Colleges", state: "CA", level: Division.D3, conference: "Southern California Intercollegiate Athletic Conference", tierLabel: "D3 / SCIAC" },
  { universityName: "Claremont-Mudd-Scripps", state: "CA", level: Division.D3, conference: "Southern California Intercollegiate Athletic Conference", tierLabel: "D3 / SCIAC" },
  { universityName: "Occidental College", state: "CA", level: Division.D3, conference: "Southern California Intercollegiate Athletic Conference", tierLabel: "D3 / SCIAC" },
  { universityName: "University of Redlands", state: "CA", level: Division.D3, conference: "Southern California Intercollegiate Athletic Conference", tierLabel: "D3 / SCIAC" },
  { universityName: "Whittier College", state: "CA", level: Division.D3, conference: "Southern California Intercollegiate Athletic Conference", tierLabel: "D3 / SCIAC" },
  { universityName: "California Lutheran University", state: "CA", level: Division.D3, conference: "Southern California Intercollegiate Athletic Conference", tierLabel: "D3 / SCIAC" },
  { universityName: "Chapman University", state: "CA", level: Division.D3, conference: "Southern California Intercollegiate Athletic Conference", tierLabel: "D3 / SCIAC" },
  { universityName: "University of La Verne", state: "CA", level: Division.D3, conference: "Southern California Intercollegiate Athletic Conference", tierLabel: "D3 / SCIAC" },

  // --- D3 Liberty League --------------------------------------------------
  { universityName: "Rensselaer Polytechnic Institute", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },
  { universityName: "Skidmore College", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },
  { universityName: "Vassar College", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },
  { universityName: "Bard College", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },
  { universityName: "Clarkson University", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },
  { universityName: "Hobart and William Smith Colleges", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },
  { universityName: "Ithaca College", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },
  { universityName: "Rochester Institute of Technology", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },
  { universityName: "St. Lawrence University", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },
  { universityName: "Union College NY", state: "NY", level: Division.D3, conference: "Liberty League", tierLabel: "D3 / Liberty League" },

  // --- D3 Empire 8 ---------------------------------------------------------
  { universityName: "Alfred University", state: "NY", level: Division.D3, conference: "Empire 8 Conference", tierLabel: "D3 / Empire 8" },
  { universityName: "Hartwick College", state: "NY", level: Division.D3, conference: "Empire 8 Conference", tierLabel: "D3 / Empire 8" },
  { universityName: "Nazareth University", state: "NY", level: Division.D3, conference: "Empire 8 Conference", tierLabel: "D3 / Empire 8" },
  { universityName: "St. John Fisher University", state: "NY", level: Division.D3, conference: "Empire 8 Conference", tierLabel: "D3 / Empire 8" },
  { universityName: "Utica University", state: "NY", level: Division.D3, conference: "Empire 8 Conference", tierLabel: "D3 / Empire 8" },

  // --- D3 SUNYAC -----------------------------------------------------------
  { universityName: "SUNY Brockport", state: "NY", level: Division.D3, conference: "State University of New York Athletic Conference", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Cortland", state: "NY", level: Division.D3, conference: "State University of New York Athletic Conference", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Geneseo", state: "NY", level: Division.D3, conference: "State University of New York Athletic Conference", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY New Paltz", state: "NY", level: Division.D3, conference: "State University of New York Athletic Conference", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Oneonta", state: "NY", level: Division.D3, conference: "State University of New York Athletic Conference", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Oswego", state: "NY", level: Division.D3, conference: "State University of New York Athletic Conference", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Plattsburgh", state: "NY", level: Division.D3, conference: "State University of New York Athletic Conference", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Potsdam", state: "NY", level: Division.D3, conference: "State University of New York Athletic Conference", tierLabel: "D3 / SUNYAC" },

  // --- D3 NEWMAC -----------------------------------------------------------
  { universityName: "Babson College", state: "MA", level: Division.D3, conference: "New England Women's and Men's Athletic Conference", tierLabel: "D3 / NEWMAC" },
  { universityName: "Clark University", state: "MA", level: Division.D3, conference: "New England Women's and Men's Athletic Conference", tierLabel: "D3 / NEWMAC" },
  { universityName: "Springfield College", state: "MA", level: Division.D3, conference: "New England Women's and Men's Athletic Conference", tierLabel: "D3 / NEWMAC" },
  { universityName: "Worcester Polytechnic Institute", state: "MA", level: Division.D3, conference: "New England Women's and Men's Athletic Conference", tierLabel: "D3 / NEWMAC" },
  { universityName: "Wheaton College MA", state: "MA", level: Division.D3, conference: "New England Women's and Men's Athletic Conference", tierLabel: "D3 / NEWMAC" },
  { universityName: "Norwich University", state: "VT", level: Division.D3, conference: "New England Women's and Men's Athletic Conference", tierLabel: "D3 / NEWMAC" },

  // --- D3 PAC --------------------------------------------------------------
  { universityName: "Allegheny College", state: "PA", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },
  { universityName: "Washington & Jefferson College", state: "PA", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },
  { universityName: "Westminster College PA", state: "PA", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },
  { universityName: "Geneva College", state: "PA", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },
  { universityName: "Saint Vincent College", state: "PA", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },
  { universityName: "Waynesburg University", state: "PA", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },
  { universityName: "Thiel College", state: "PA", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },
  { universityName: "Bethany College WV", state: "WV", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },
  { universityName: "Grove City College", state: "PA", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },
  { universityName: "Chatham University", state: "PA", level: Division.D3, conference: "Presidents' Athletic Conference", tierLabel: "D3 / PAC" },

  // --- D3 NJAC -------------------------------------------------------------
  { universityName: "Stockton University", state: "NJ", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Ramapo College", state: "NJ", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Kean University", state: "NJ", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "William Paterson University", state: "NJ", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },
  { universityName: "Rutgers University-Newark", state: "NJ", level: Division.D3, conference: "New Jersey Athletic Conference", tierLabel: "D3 / NJAC" },

  // --- D3 American Rivers Conference --------------------------------------
  { universityName: "Wartburg College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Central College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Loras College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Coe College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Simpson College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Buena Vista University", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Luther College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Cornell College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "University of Dubuque", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },

  // --- D3 MAC Commonwealth ------------------------------------------------
  { universityName: "Albright College", state: "PA", level: Division.D3, conference: "Middle Atlantic Conferences Commonwealth", tierLabel: "D3 / MAC Commonwealth" },
  { universityName: "Alvernia University", state: "PA", level: Division.D3, conference: "Middle Atlantic Conferences Commonwealth", tierLabel: "D3 / MAC Commonwealth" },
  { universityName: "Lebanon Valley College", state: "PA", level: Division.D3, conference: "Middle Atlantic Conferences Commonwealth", tierLabel: "D3 / MAC Commonwealth" },
  { universityName: "Lycoming College", state: "PA", level: Division.D3, conference: "Middle Atlantic Conferences Commonwealth", tierLabel: "D3 / MAC Commonwealth" },
  { universityName: "Messiah University", state: "PA", level: Division.D3, conference: "Middle Atlantic Conferences Commonwealth", tierLabel: "D3 / MAC Commonwealth" },
  { universityName: "Widener University", state: "PA", level: Division.D3, conference: "Middle Atlantic Conferences Commonwealth", tierLabel: "D3 / MAC Commonwealth" },
  { universityName: "Stevenson University", state: "MD", level: Division.D3, conference: "Middle Atlantic Conferences Commonwealth", tierLabel: "D3 / MAC Commonwealth" },

  // --- D3 USA South -------------------------------------------------------
  { universityName: "Meredith College", state: "NC", level: Division.D3, conference: "USA South Athletic Conference", tierLabel: "D3 / USA South" },
  { universityName: "William Peace University", state: "NC", level: Division.D3, conference: "USA South Athletic Conference", tierLabel: "D3 / USA South" },
  { universityName: "Brevard College", state: "NC", level: Division.D3, conference: "USA South Athletic Conference", tierLabel: "D3 / USA South" },
  { universityName: "Pfeiffer University", state: "NC", level: Division.D3, conference: "USA South Athletic Conference", tierLabel: "D3 / USA South" },
  { universityName: "Mary Baldwin University", state: "VA", level: Division.D3, conference: "USA South Athletic Conference", tierLabel: "D3 / USA South" },

  // --- NAIA KCAC ----------------------------------------------------------
  { universityName: "Tabor College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "McPherson College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Friends University", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Kansas Wesleyan University", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Sterling College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Ottawa University", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "University of Saint Mary", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Bethel College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Southwestern College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },

  // --- NAIA Great Plains --------------------------------------------------
  { universityName: "Northwestern College", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Hastings College", state: "NE", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Dordt University", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Doane University", state: "NE", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Briar Cliff University", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Concordia University Nebraska", state: "NE", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },

  // --- NAIA Heart of America ----------------------------------------------
  { universityName: "Grand View University", state: "IA", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / Heart" },
  { universityName: "MidAmerica Nazarene University", state: "KS", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / Heart" },
  { universityName: "Mount Mercy University", state: "IA", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / Heart" },

  // --- NAIA Mid-South -----------------------------------------------------
  { universityName: "University of the Cumberlands", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Lindsey Wilson College", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Campbellsville University", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Cumberland University", state: "TN", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "University of Pikeville", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Asbury University", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },

  // --- NAIA Sun Conference ------------------------------------------------
  { universityName: "Keiser University", state: "FL", level: Division.NAIA, conference: "The Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Saint Thomas University", state: "FL", level: Division.NAIA, conference: "The Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Webber International University", state: "FL", level: Division.NAIA, conference: "The Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Ave Maria University", state: "FL", level: Division.NAIA, conference: "The Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Florida Memorial University", state: "FL", level: Division.NAIA, conference: "The Sun Conference", tierLabel: "NAIA / Sun" },
  { universityName: "Faulkner University", state: "AL", level: Division.NAIA, conference: "The Sun Conference", tierLabel: "NAIA / Sun" },

  // --- NAIA Cascade -------------------------------------------------------
  { universityName: "The College of Idaho", state: "ID", level: Division.NAIA, conference: "Cascade Collegiate Conference", tierLabel: "NAIA / Cascade" },
  { universityName: "Northwest University", state: "WA", level: Division.NAIA, conference: "Cascade Collegiate Conference", tierLabel: "NAIA / Cascade" },
  { universityName: "Eastern Oregon University", state: "OR", level: Division.NAIA, conference: "Cascade Collegiate Conference", tierLabel: "NAIA / Cascade" },
  { universityName: "Southern Oregon University", state: "OR", level: Division.NAIA, conference: "Cascade Collegiate Conference", tierLabel: "NAIA / Cascade" },

  // --- NAIA Frontier ------------------------------------------------------
  { universityName: "Lewis-Clark State College", state: "ID", level: Division.NAIA, conference: "Frontier Conference", tierLabel: "NAIA / Frontier" },
  { universityName: "University of Montana Western", state: "MT", level: Division.NAIA, conference: "Frontier Conference", tierLabel: "NAIA / Frontier" },
  { universityName: "Montana Tech of the University of Montana", state: "MT", level: Division.NAIA, conference: "Frontier Conference", tierLabel: "NAIA / Frontier" },

  // --- NAIA Crossroads ----------------------------------------------------
  { universityName: "Goshen College", state: "IN", level: Division.NAIA, conference: "Crossroads League", tierLabel: "NAIA / Crossroads" },
  { universityName: "Bethel University Indiana", state: "IN", level: Division.NAIA, conference: "Crossroads League", tierLabel: "NAIA / Crossroads" },
  { universityName: "Huntington University", state: "IN", level: Division.NAIA, conference: "Crossroads League", tierLabel: "NAIA / Crossroads" },
  { universityName: "Grace College", state: "IN", level: Division.NAIA, conference: "Crossroads League", tierLabel: "NAIA / Crossroads" },

  // --- NAIA Mid-States Football Association (also basketball home) --------
  { universityName: "Marian University", state: "IN", level: Division.NAIA, conference: "Crossroads League", tierLabel: "NAIA / Crossroads" },
  { universityName: "Olivet Nazarene University", state: "IL", level: Division.NAIA, conference: "Chicagoland Collegiate Athletic Conference", tierLabel: "NAIA / CCAC" },
  { universityName: "Saint Xavier University", state: "IL", level: Division.NAIA, conference: "Chicagoland Collegiate Athletic Conference", tierLabel: "NAIA / CCAC" },
  { universityName: "University of Saint Francis", state: "IN", level: Division.NAIA, conference: "Crossroads League", tierLabel: "NAIA / Crossroads" },

  // --- NAIA AAC -----------------------------------------------------------
  { universityName: "Reinhardt University", state: "GA", level: Division.NAIA, conference: "Appalachian Athletic Conference", tierLabel: "NAIA / AAC" },

  // --- JUCO CCCAA (California) --------------------------------------------
  { universityName: "Mt. San Antonio College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Riverside City College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Fullerton College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Pasadena City College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Bakersfield College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Long Beach City College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Saddleback College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "East Los Angeles College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Citrus College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Chaffey College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Compton College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },

  // --- JUCO KJCCC (Kansas) ------------------------------------------------
  { universityName: "Garden City Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "JUCO / KJCCC" },
  { universityName: "Independence Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "JUCO / KJCCC" },
  { universityName: "Coffeyville Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "JUCO / KJCCC" },
  { universityName: "Highland Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "JUCO / KJCCC" },
  { universityName: "Dodge City Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "JUCO / KJCCC" },
  { universityName: "Fort Scott Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "JUCO / KJCCC" },

  // --- JUCO Texas / SWJCFC + Region 14 ------------------------------------
  { universityName: "Tyler Junior College", state: "TX", level: Division.NJCAA, conference: "NJCAA Region 14", tierLabel: "JUCO / TX" },
  { universityName: "Trinity Valley Community College", state: "TX", level: Division.NJCAA, conference: "NJCAA Region 14", tierLabel: "JUCO / TX" },
  { universityName: "Navarro College", state: "TX", level: Division.NJCAA, conference: "NJCAA Region 14", tierLabel: "JUCO / TX" },
  { universityName: "Blinn College", state: "TX", level: Division.NJCAA, conference: "NJCAA Region 14", tierLabel: "JUCO / TX" },
  { universityName: "Kilgore College", state: "TX", level: Division.NJCAA, conference: "NJCAA Region 14", tierLabel: "JUCO / TX" },
  { universityName: "Cisco College", state: "TX", level: Division.NJCAA, conference: "NJCAA Region 14", tierLabel: "JUCO / TX" },

  // --- JUCO MACCC (Mississippi) -------------------------------------------
  { universityName: "Hinds Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Jones College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Mississippi Gulf Coast Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Northwest Mississippi Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Pearl River Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Holmes Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Itawamba Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Copiah-Lincoln Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "East Central Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Southwest Mississippi Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Coahoma Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },
  { universityName: "Mississippi Delta Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "JUCO / MACCC" },

  // --- JUCO ICCAC (Iowa) --------------------------------------------------
  { universityName: "Iowa Central Community College", state: "IA", level: Division.NJCAA, conference: "ICCAC", tierLabel: "JUCO / ICCAC" },
  { universityName: "Iowa Lakes Community College", state: "IA", level: Division.NJCAA, conference: "ICCAC", tierLabel: "JUCO / ICCAC" },
  { universityName: "Kirkwood Community College", state: "IA", level: Division.NJCAA, conference: "ICCAC", tierLabel: "JUCO / ICCAC" },
  { universityName: "Ellsworth Community College", state: "IA", level: Division.NJCAA, conference: "ICCAC", tierLabel: "JUCO / ICCAC" },

  // --- JUCO Scenic West ---------------------------------------------------
  { universityName: "Snow College", state: "UT", level: Division.NJCAA, conference: "Scenic West Athletic Conference", tierLabel: "JUCO / SWAC" },

  // --- JUCO Other NJCAA Football powers (also field WBB) ------------------
  { universityName: "Northeastern Oklahoma A&M College", state: "OK", level: Division.NJCAA, conference: "NJCAA", tierLabel: "JUCO" },
  { universityName: "Northern Oklahoma College", state: "OK", level: Division.NJCAA, conference: "NJCAA", tierLabel: "JUCO" },
  { universityName: "Wallace State Community College", state: "AL", level: Division.NJCAA, conference: "Alabama Community College Conference", tierLabel: "JUCO / ACCC" },
];

interface SeedStats {
  universitiesCreated: number;
  universitiesReused: number;
  programsCreated: number;
  programsSkipped: number;
  errors: { school: string; message: string }[];
}

async function findOrCreateUniversity(seed: WBBSeed): Promise<{ id: string; created: boolean }> {
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

async function findOrCreateWBBProgram(
  universityId: string,
  seed: WBBSeed
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
  console.log(`🏀  Seeding ${WBB_PROGRAMS.length} major Women's Basketball programs…\n`);

  const stats: SeedStats = {
    universitiesCreated: 0,
    universitiesReused: 0,
    programsCreated: 0,
    programsSkipped: 0,
    errors: [],
  };

  for (const seed of WBB_PROGRAMS) {
    try {
      const u = await findOrCreateUniversity(seed);
      stats[u.created ? "universitiesCreated" : "universitiesReused"]++;
      const p = await findOrCreateWBBProgram(u.id, seed);
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
  console.log(`Universities created:        ${stats.universitiesCreated}`);
  console.log(`Universities reused:         ${stats.universitiesReused}`);
  console.log(`Women's Basketball created:  ${stats.programsCreated}`);
  console.log(`Women's Basketball skipped:  ${stats.programsSkipped} (already existed)`);
  console.log(`Errors: ${stats.errors.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
