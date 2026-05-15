/**
 * Seed major Softball programs across every NCAA / NAIA / NJCAA tier.
 *
 * Conservative + idempotent (same contract as seed-major-football-programs.ts,
 * seed-major-womens-basketball-programs.ts, and seed-major-womens-soccer-programs.ts):
 *   - University rows that already exist (matched by exact name OR slug) are
 *     reused — never overwritten.
 *   - Softball School rows that already exist for that university
 *     are skipped — we never create a duplicate (universityId, "Softball").
 *   - Coaches are NOT created here. Attach verified coaches via the CSV
 *     importer once the head coach is confirmed by name + source URL.
 *
 * Sport: "Softball" (Women).
 *
 * Notes specific to softball:
 *   - Not every D1 school fields softball. Schools without varsity softball
 *     that are intentionally EXCLUDED from this list:
 *       SEC: Vanderbilt
 *       Big Ten: Wisconsin
 *       ACC: Miami (FL), Wake Forest
 *       Big 12: Colorado
 *       AAC: Temple (cut after 2014)
 *     If you add an SEC/B1G/ACC/Big 12 school here, double-check its athletics
 *     site lists softball before merging.
 *   - Softball conferences sometimes differ from football/basketball. e.g.
 *     Washington State and Oregon State currently play softball as Pac-12
 *     affiliates after the 2024 realignment.
 *
 * Usage:
 *   npm run seed:softball-major
 *
 * Add new schools at the bottom of SOFTBALL_PROGRAMS — keep grouped by tier
 * and conference so the diff stays reviewable.
 */
import { PrismaClient, Division } from "@prisma/client";
import { normalizeSlug } from "../src/lib/normalize";

const prisma = new PrismaClient();

const SPORT = "Softball";

interface SoftballSeed {
  universityName: string;
  city?: string;
  state?: string;
  websiteUrl?: string;
  athleticsWebsite?: string;
  level: Division;          // university-level division
  conference: string;       // softball conference
  tierLabel: string;        // console-output tag only
}

// ---------------------------------------------------------------------------
// Real, currently-active Softball programs only. Do not invent.
// Each addition must be verifiable against an official athletics website or
// NCAA/NAIA/NJCAA conference page.
// ---------------------------------------------------------------------------
const SOFTBALL_PROGRAMS: SoftballSeed[] = [
  // --- D1 SEC (Vanderbilt excluded — no varsity softball) ------------------
  { universityName: "University of Alabama", state: "AL", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "University of Arkansas", state: "AR", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
  { universityName: "Auburn University", state: "AL", level: Division.D1, conference: "SEC", tierLabel: "D1 / SEC" },
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

  // --- D1 Big Ten (Wisconsin excluded — no varsity softball) ---------------
  { universityName: "University of Illinois", state: "IL", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
  { universityName: "Indiana University", state: "IN", level: Division.D1, conference: "Big Ten", tierLabel: "D1 / Big Ten" },
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

  // --- D1 ACC (Miami and Wake Forest excluded — no varsity softball) -------
  { universityName: "Boston College", state: "MA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of California, Berkeley", state: "CA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Clemson University", state: "SC", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Duke University", state: "NC", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Florida State University", state: "FL", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Georgia Institute of Technology", state: "GA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Louisville", state: "KY", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of North Carolina at Chapel Hill", state: "NC", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "North Carolina State University", state: "NC", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Notre Dame", state: "IN", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Pittsburgh", state: "PA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Southern Methodist University", state: "TX", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Stanford University", state: "CA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Syracuse University", state: "NY", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "University of Virginia", state: "VA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },
  { universityName: "Virginia Tech", state: "VA", level: Division.D1, conference: "ACC", tierLabel: "D1 / ACC" },

  // --- D1 Big 12 (Colorado excluded — no varsity softball) -----------------
  { universityName: "University of Arizona", state: "AZ", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Arizona State University", state: "AZ", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Baylor University", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Brigham Young University", state: "UT", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Cincinnati", state: "OH", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Houston", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Iowa State University", state: "IA", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Kansas", state: "KS", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Kansas State University", state: "KS", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Oklahoma State University", state: "OK", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Texas Christian University", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "Texas Tech University", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Central Florida", state: "FL", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "University of Utah", state: "UT", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },
  { universityName: "West Virginia University", state: "WV", level: Division.D1, conference: "Big 12", tierLabel: "D1 / Big 12" },

  // --- D1 Pac-12 (post-realignment: WSU + OSU softball) --------------------
  { universityName: "Oregon State University", state: "OR", level: Division.D1, conference: "Pac-12", tierLabel: "D1 / Pac-12" },
  { universityName: "Washington State University", state: "WA", level: Division.D1, conference: "Pac-12", tierLabel: "D1 / Pac-12" },

  // --- D1 American Athletic Conference (AAC) -------------------------------
  { universityName: "University of North Carolina at Charlotte", state: "NC", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "East Carolina University", state: "NC", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Florida Atlantic University", state: "FL", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Memphis", state: "TN", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of North Texas", state: "TX", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Rice University", state: "TX", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of South Florida", state: "FL", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Tulsa", state: "OK", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Alabama at Birmingham", state: "AL", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "University of Texas at San Antonio", state: "TX", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },
  { universityName: "Wichita State University", state: "KS", level: Division.D1, conference: "American Athletic Conference", tierLabel: "D1 / AAC" },

  // --- D1 Sun Belt ---------------------------------------------------------
  { universityName: "Appalachian State University", state: "NC", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Arkansas State University", state: "AR", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Coastal Carolina University", state: "SC", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Georgia Southern University", state: "GA", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Georgia State University", state: "GA", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "James Madison University", state: "VA", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of Louisiana at Lafayette", state: "LA", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of Louisiana at Monroe", state: "LA", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Marshall University", state: "WV", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Old Dominion University", state: "VA", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of South Alabama", state: "AL", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "University of Southern Mississippi", state: "MS", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Texas State University", state: "TX", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },
  { universityName: "Troy University", state: "AL", level: Division.D1, conference: "Sun Belt Conference", tierLabel: "D1 / Sun Belt" },

  // --- D1 Conference USA ---------------------------------------------------
  { universityName: "Florida International University", state: "FL", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Jacksonville State University", state: "AL", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Liberty University", state: "VA", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Louisiana Tech University", state: "LA", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Middle Tennessee State University", state: "TN", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "University of Texas at El Paso", state: "TX", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },
  { universityName: "Western Kentucky University", state: "KY", level: Division.D1, conference: "Conference USA", tierLabel: "D1 / C-USA" },

  // --- D1 Mid-American Conference (MAC) ------------------------------------
  { universityName: "University of Akron", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Ball State University", state: "IN", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Bowling Green State University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "University at Buffalo", state: "NY", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Central Michigan University", state: "MI", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Eastern Michigan University", state: "MI", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Kent State University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Miami University Ohio", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Northern Illinois University", state: "IL", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Ohio University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "University of Toledo", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },
  { universityName: "Western Michigan University", state: "MI", level: Division.D1, conference: "Mid-American Conference", tierLabel: "D1 / MAC" },

  // --- D1 Mountain West Conference -----------------------------------------
  { universityName: "Boise State University", state: "ID", level: Division.D1, conference: "Mountain West Conference", tierLabel: "D1 / MWC" },
  { universityName: "Colorado State University", state: "CO", level: Division.D1, conference: "Mountain West Conference", tierLabel: "D1 / MWC" },
  { universityName: "Fresno State University", state: "CA", level: Division.D1, conference: "Mountain West Conference", tierLabel: "D1 / MWC" },
  { universityName: "University of Nevada, Las Vegas", state: "NV", level: Division.D1, conference: "Mountain West Conference", tierLabel: "D1 / MWC" },
  { universityName: "University of Nevada, Reno", state: "NV", level: Division.D1, conference: "Mountain West Conference", tierLabel: "D1 / MWC" },
  { universityName: "San Diego State University", state: "CA", level: Division.D1, conference: "Mountain West Conference", tierLabel: "D1 / MWC" },
  { universityName: "San Jose State University", state: "CA", level: Division.D1, conference: "Mountain West Conference", tierLabel: "D1 / MWC" },
  { universityName: "Utah State University", state: "UT", level: Division.D1, conference: "Mountain West Conference", tierLabel: "D1 / MWC" },

  // --- D1 Atlantic 10 (A-10) -----------------------------------------------
  { universityName: "Davidson College", state: "NC", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "University of Dayton", state: "OH", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Duquesne University", state: "PA", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Fordham University", state: "NY", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "George Mason University", state: "VA", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "George Washington University", state: "DC", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "La Salle University", state: "PA", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "University of Massachusetts", state: "MA", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Saint Joseph's University", state: "PA", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Saint Louis University", state: "MO", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "St. Bonaventure University", state: "NY", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },
  { universityName: "Virginia Commonwealth University", state: "VA", level: Division.D1, conference: "Atlantic 10 Conference", tierLabel: "D1 / A-10" },

  // --- D1 Big East ---------------------------------------------------------
  { universityName: "Butler University", state: "IN", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "DePaul University", state: "IL", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Georgetown University", state: "DC", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Seton Hall University", state: "NJ", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "St. John's University", state: "NY", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },
  { universityName: "Villanova University", state: "PA", level: Division.D1, conference: "Big East Conference", tierLabel: "D1 / Big East" },

  // --- D1 ASUN Conference --------------------------------------------------
  { universityName: "Bellarmine University", state: "KY", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Eastern Kentucky University", state: "KY", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Florida Gulf Coast University", state: "FL", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Jacksonville University", state: "FL", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Lipscomb University", state: "TN", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "University of North Alabama", state: "AL", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "University of North Florida", state: "FL", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },
  { universityName: "Stetson University", state: "FL", level: Division.D1, conference: "ASUN Conference", tierLabel: "D1 / ASUN" },

  // --- D1 Big South --------------------------------------------------------
  { universityName: "Charleston Southern University", state: "SC", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },
  { universityName: "Gardner-Webb University", state: "NC", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },
  { universityName: "High Point University", state: "NC", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },
  { universityName: "Longwood University", state: "VA", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },
  { universityName: "Presbyterian College", state: "SC", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },
  { universityName: "Radford University", state: "VA", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },
  { universityName: "University of South Carolina Upstate", state: "SC", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },
  { universityName: "Winthrop University", state: "SC", level: Division.D1, conference: "Big South Conference", tierLabel: "D1 / Big South" },

  // --- D1 Coastal Athletic Association (CAA) -------------------------------
  { universityName: "College of Charleston", state: "SC", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "University of Delaware", state: "DE", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Drexel University", state: "PA", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Elon University", state: "NC", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Hofstra University", state: "NY", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Monmouth University", state: "NJ", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "University of North Carolina Wilmington", state: "NC", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Stony Brook University", state: "NY", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "Towson University", state: "MD", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },
  { universityName: "William & Mary", state: "VA", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "D1 / CAA" },

  // --- D1 Horizon League ---------------------------------------------------
  { universityName: "Cleveland State University", state: "OH", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "University of Detroit Mercy", state: "MI", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "University of Green Bay", state: "WI", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "University of Illinois Chicago", state: "IL", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Northern Kentucky University", state: "KY", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Oakland University", state: "MI", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Purdue University Fort Wayne", state: "IN", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Robert Morris University", state: "PA", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "University of Wisconsin-Milwaukee", state: "WI", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Wright State University", state: "OH", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },
  { universityName: "Youngstown State University", state: "OH", level: Division.D1, conference: "Horizon League", tierLabel: "D1 / Horizon" },

  // --- D1 Ivy League -------------------------------------------------------
  { universityName: "Brown University", state: "RI", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Columbia University", state: "NY", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Cornell University", state: "NY", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Dartmouth College", state: "NH", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Harvard University", state: "MA", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "University of Pennsylvania", state: "PA", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Princeton University", state: "NJ", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },
  { universityName: "Yale University", state: "CT", level: Division.D1, conference: "Ivy League", tierLabel: "D1 / Ivy" },

  // --- D1 Missouri Valley Conference (MVC) ---------------------------------
  { universityName: "Bradley University", state: "IL", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Drake University", state: "IA", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "University of Evansville", state: "IN", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Illinois State University", state: "IL", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Indiana State University", state: "IN", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Murray State University", state: "KY", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "University of Northern Iowa", state: "IA", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Southern Illinois University", state: "IL", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },
  { universityName: "Valparaiso University", state: "IN", level: Division.D1, conference: "Missouri Valley Conference", tierLabel: "D1 / MVC" },

  // --- D1 Northeast Conference (NEC) ---------------------------------------
  { universityName: "Central Connecticut State University", state: "CT", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Fairleigh Dickinson University", state: "NJ", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Le Moyne College", state: "NY", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Long Island University", state: "NY", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Mercyhurst University", state: "PA", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Saint Francis University", state: "PA", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Stonehill College", state: "MA", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },
  { universityName: "Wagner College", state: "NY", level: Division.D1, conference: "Northeast Conference", tierLabel: "D1 / NEC" },

  // --- D1 Ohio Valley Conference (OVC) -------------------------------------
  { universityName: "Eastern Illinois University", state: "IL", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Lindenwood University", state: "MO", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Morehead State University", state: "KY", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Southeast Missouri State University", state: "MO", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Southern Indiana University", state: "IN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Tennessee State University", state: "TN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Tennessee Tech University", state: "TN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "University of Tennessee at Martin", state: "TN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },
  { universityName: "Western Illinois University", state: "IL", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "D1 / OVC" },

  // --- D1 Patriot League ---------------------------------------------------
  { universityName: "American University", state: "DC", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Army West Point", state: "NY", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Boston University", state: "MA", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Bucknell University", state: "PA", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Colgate University", state: "NY", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "College of the Holy Cross", state: "MA", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Lafayette College", state: "PA", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "Lehigh University", state: "PA", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },
  { universityName: "United States Naval Academy", state: "MD", level: Division.D1, conference: "Patriot League", tierLabel: "D1 / Patriot" },

  // --- D1 Southland Conference ---------------------------------------------
  { universityName: "Houston Christian University", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "University of the Incarnate Word", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Lamar University", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "McNeese State University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "University of New Orleans", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Nicholls State University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Northwestern State University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Southeastern Louisiana University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Stephen F. Austin State University", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },
  { universityName: "Texas A&M University-Corpus Christi", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "D1 / Southland" },

  // --- D1 SWAC -------------------------------------------------------------
  { universityName: "Alabama A&M University", state: "AL", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Alabama State University", state: "AL", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Alcorn State University", state: "MS", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "University of Arkansas at Pine Bluff", state: "AR", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Bethune-Cookman University", state: "FL", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Florida A&M University", state: "FL", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Grambling State University", state: "LA", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Jackson State University", state: "MS", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Mississippi Valley State University", state: "MS", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Prairie View A&M University", state: "TX", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Southern University", state: "LA", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },
  { universityName: "Texas Southern University", state: "TX", level: Division.D1, conference: "SWAC", tierLabel: "D1 / SWAC" },

  // --- D1 Summit League ----------------------------------------------------
  { universityName: "University of North Dakota", state: "ND", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "North Dakota State University", state: "ND", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "University of South Dakota", state: "SD", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "South Dakota State University", state: "SD", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "University of St. Thomas Minnesota", state: "MN", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },
  { universityName: "University of Nebraska Omaha", state: "NE", level: Division.D1, conference: "Summit League", tierLabel: "D1 / Summit" },

  // --- D1 WAC --------------------------------------------------------------
  { universityName: "Abilene Christian University", state: "TX", level: Division.D1, conference: "Western Athletic Conference", tierLabel: "D1 / WAC" },
  { universityName: "California Baptist University", state: "CA", level: Division.D1, conference: "Western Athletic Conference", tierLabel: "D1 / WAC" },
  { universityName: "Grand Canyon University", state: "AZ", level: Division.D1, conference: "Western Athletic Conference", tierLabel: "D1 / WAC" },
  { universityName: "Tarleton State University", state: "TX", level: Division.D1, conference: "Western Athletic Conference", tierLabel: "D1 / WAC" },
  { universityName: "University of Texas Rio Grande Valley", state: "TX", level: Division.D1, conference: "Western Athletic Conference", tierLabel: "D1 / WAC" },
  { universityName: "Utah Tech University", state: "UT", level: Division.D1, conference: "Western Athletic Conference", tierLabel: "D1 / WAC" },
  { universityName: "Utah Valley University", state: "UT", level: Division.D1, conference: "Western Athletic Conference", tierLabel: "D1 / WAC" },

  // --- D1 MAAC -------------------------------------------------------------
  { universityName: "Canisius University", state: "NY", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },
  { universityName: "Fairfield University", state: "CT", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },
  { universityName: "Iona University", state: "NY", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },
  { universityName: "Manhattan College", state: "NY", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },
  { universityName: "Marist College", state: "NY", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },
  { universityName: "Niagara University", state: "NY", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },
  { universityName: "Quinnipiac University", state: "CT", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },
  { universityName: "Rider University", state: "NJ", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },
  { universityName: "Sacred Heart University", state: "CT", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },
  { universityName: "Siena College", state: "NY", level: Division.D1, conference: "MAAC", tierLabel: "D1 / MAAC" },

  // --- D2 Lone Star Conference ---------------------------------------------
  { universityName: "Angelo State University", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Cameron University", state: "OK", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Eastern New Mexico University", state: "NM", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Lubbock Christian University", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Midwestern State University", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Oklahoma Christian University", state: "OK", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "St. Edward's University", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "St. Mary's University Texas", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Texas A&M University-Commerce", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Texas A&M University-Kingsville", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Texas Woman's University", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "University of Texas Permian Basin", state: "TX", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },
  { universityName: "Western New Mexico University", state: "NM", level: Division.D2, conference: "Lone Star Conference", tierLabel: "D2 / LSC" },

  // --- D2 MIAA -------------------------------------------------------------
  { universityName: "Central Missouri", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Central Oklahoma", state: "OK", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Emporia State University", state: "KS", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Fort Hays State University", state: "KS", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Lincoln University Missouri", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Missouri Southern State University", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Missouri Western State University", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "University of Nebraska at Kearney", state: "NE", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Newman University", state: "KS", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Northwest Missouri State University", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Pittsburg State University", state: "KS", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Rogers State University", state: "OK", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },
  { universityName: "Washburn University", state: "KS", level: Division.D2, conference: "MIAA", tierLabel: "D2 / MIAA" },

  // --- D2 PSAC -------------------------------------------------------------
  { universityName: "Bloomsburg University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "California University of Pennsylvania", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "East Stroudsburg University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Edinboro University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Indiana University of Pennsylvania", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Kutztown University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Lock Haven University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Millersville University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Seton Hill University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Shepherd University", state: "WV", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Shippensburg University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "Slippery Rock University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },
  { universityName: "West Chester University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2 / PSAC" },

  // --- D2 NSIC -------------------------------------------------------------
  { universityName: "Augustana University South Dakota", state: "SD", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Bemidji State University", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Concordia University Saint Paul", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Minnesota Duluth", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Minnesota State University Mankato", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Minnesota State University Moorhead", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Minot State University", state: "ND", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Northern State University", state: "SD", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Saint Cloud State University", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Southwest Minnesota State University", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "University of Mary", state: "ND", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Wayne State College", state: "NE", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },
  { universityName: "Winona State University", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2 / NSIC" },

  // --- D2 Sunshine State Conference (SSC) ----------------------------------
  { universityName: "Barry University", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Eckerd College", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Embry-Riddle Aeronautical University", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Florida Southern College", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Lynn University", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Nova Southeastern University", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Palm Beach Atlantic University", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Rollins College", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "Saint Leo University", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },
  { universityName: "University of Tampa", state: "FL", level: Division.D2, conference: "Sunshine State Conference", tierLabel: "D2 / SSC" },

  // --- D2 Gulf South Conference --------------------------------------------
  { universityName: "Alabama-Huntsville", state: "AL", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Auburn University at Montgomery", state: "AL", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Christian Brothers University", state: "TN", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Delta State University", state: "MS", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Lee University", state: "TN", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Mississippi College", state: "MS", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "University of Montevallo", state: "AL", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Trevecca Nazarene University", state: "TN", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Union University Tennessee", state: "TN", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "Valdosta State University", state: "GA", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "University of West Alabama", state: "AL", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },
  { universityName: "University of West Florida", state: "FL", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2 / Gulf South" },

  // --- D2 South Atlantic Conference (SAC) ----------------------------------
  { universityName: "Anderson University South Carolina", state: "SC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Carson-Newman University", state: "TN", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Catawba College", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Coker University", state: "SC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Emory & Henry College", state: "VA", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Lenoir-Rhyne University", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Limestone University", state: "SC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Lincoln Memorial University", state: "TN", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Mars Hill University", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Newberry College", state: "SC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Tusculum University", state: "TN", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },
  { universityName: "Wingate University", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2 / SAC" },

  // --- D2 RMAC -------------------------------------------------------------
  { universityName: "Adams State University", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Black Hills State University", state: "SD", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Chadron State College", state: "NE", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado Christian University", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado Mesa University", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado School of Mines", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Colorado State University Pueblo", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Metropolitan State University of Denver", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "New Mexico Highlands University", state: "NM", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Regis University", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "South Dakota School of Mines and Technology", state: "SD", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "University of Colorado Colorado Springs", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },
  { universityName: "Western Colorado University", state: "CO", level: Division.D2, conference: "RMAC", tierLabel: "D2 / RMAC" },

  // --- D2 GLIAC ------------------------------------------------------------
  { universityName: "Davenport University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Ferris State University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Grand Valley State University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Lake Superior State University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Michigan Tech University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Northern Michigan University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Northwood University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "University of Wisconsin-Parkside", state: "WI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Purdue University Northwest", state: "IN", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Saginaw Valley State University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },
  { universityName: "Wayne State University Michigan", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2 / GLIAC" },

  // --- D2 GLVC -------------------------------------------------------------
  { universityName: "Drury University", state: "MO", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "University of Indianapolis", state: "IN", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Lewis University", state: "IL", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Maryville University Saint Louis", state: "MO", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "McKendree University", state: "IL", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Missouri S&T", state: "MO", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Quincy University", state: "IL", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Rockhurst University", state: "MO", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "Truman State University", state: "MO", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "University of Illinois Springfield", state: "IL", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "University of Missouri-St. Louis", state: "MO", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },
  { universityName: "William Jewell College", state: "MO", level: Division.D2, conference: "GLVC", tierLabel: "D2 / GLVC" },

  // --- D2 Great American Conference (GAC) ----------------------------------
  { universityName: "Arkansas Tech University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "East Central University", state: "OK", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Harding University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Henderson State University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Northwestern Oklahoma State University", state: "OK", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Oklahoma Baptist University", state: "OK", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Ouachita Baptist University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Southeastern Oklahoma State University", state: "OK", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Southern Arkansas University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "Southwestern Oklahoma State University", state: "OK", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },
  { universityName: "University of Arkansas at Monticello", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2 / GAC" },

  // --- D2 California Collegiate Athletic Association (CCAA) ---------------
  { universityName: "California State University, Chico", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, Dominguez Hills", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, East Bay", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, Los Angeles", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, Monterey Bay", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, San Bernardino", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, San Marcos", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "California State University, Stanislaus", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "Cal Poly Humboldt", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "Cal Poly Pomona", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },
  { universityName: "Sonoma State University", state: "CA", level: Division.D2, conference: "CCAA", tierLabel: "D2 / CCAA" },

  // --- D3 NESCAC -----------------------------------------------------------
  { universityName: "Amherst College", state: "MA", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Bates College", state: "ME", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Bowdoin College", state: "ME", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Trinity College Connecticut", state: "CT", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Tufts University", state: "MA", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Wesleyan University", state: "CT", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },
  { universityName: "Williams College", state: "MA", level: Division.D3, conference: "NESCAC", tierLabel: "D3 / NESCAC" },

  // --- D3 University Athletic Association (UAA) ----------------------------
  { universityName: "Brandeis University", state: "MA", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Carnegie Mellon University", state: "PA", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Case Western Reserve University", state: "OH", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Emory University", state: "GA", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "New York University", state: "NY", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "University of Chicago", state: "IL", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },
  { universityName: "Washington University in St. Louis", state: "MO", level: Division.D3, conference: "UAA", tierLabel: "D3 / UAA" },

  // --- D3 SUNYAC -----------------------------------------------------------
  { universityName: "SUNY Brockport", state: "NY", level: Division.D3, conference: "SUNYAC", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Cortland", state: "NY", level: Division.D3, conference: "SUNYAC", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Geneseo", state: "NY", level: Division.D3, conference: "SUNYAC", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY New Paltz", state: "NY", level: Division.D3, conference: "SUNYAC", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Oneonta", state: "NY", level: Division.D3, conference: "SUNYAC", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Oswego", state: "NY", level: Division.D3, conference: "SUNYAC", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Plattsburgh", state: "NY", level: Division.D3, conference: "SUNYAC", tierLabel: "D3 / SUNYAC" },
  { universityName: "SUNY Potsdam", state: "NY", level: Division.D3, conference: "SUNYAC", tierLabel: "D3 / SUNYAC" },

  // --- D3 OAC --------------------------------------------------------------
  { universityName: "Baldwin Wallace University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Capital University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Heidelberg University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "John Carroll University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Marietta College", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Mount Union University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Muskingum University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Ohio Northern University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Otterbein University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },
  { universityName: "Wilmington College Ohio", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3 / OAC" },

  // --- D3 American Rivers Conference (ARC) --------------------------------
  { universityName: "Buena Vista University", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Central College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Coe College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Cornell College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Loras College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Luther College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Nebraska Wesleyan University", state: "NE", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Simpson College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "University of Dubuque", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },
  { universityName: "Wartburg College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3 / ARC" },

  // --- NAIA Mid-South Conference -------------------------------------------
  { universityName: "Bethel University Tennessee", state: "TN", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Campbellsville University", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Cumberland University", state: "TN", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "University of the Cumberlands", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Freed-Hardeman University", state: "TN", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "Lindsey Wilson College", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },
  { universityName: "University of Pikeville", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA / Mid-South" },

  // --- NAIA Heart of America Athletic Conference --------------------------
  { universityName: "Baker University", state: "KS", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Benedictine College", state: "KS", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Central Methodist University", state: "MO", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Clarke University", state: "IA", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Culver-Stockton College", state: "MO", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Evangel University", state: "MO", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Grand View University", state: "IA", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Graceland University", state: "IA", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "MidAmerica Nazarene University", state: "KS", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Missouri Valley College", state: "MO", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Mount Mercy University", state: "IA", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "Peru State College", state: "NE", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },
  { universityName: "William Penn University", state: "IA", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA / HAAC" },

  // --- NAIA Great Plains Athletic Conference ------------------------------
  { universityName: "Briar Cliff University", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Concordia University Nebraska", state: "NE", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Dakota Wesleyan University", state: "SD", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Doane University", state: "NE", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Dordt University", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Hastings College", state: "NE", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Midland University", state: "NE", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Morningside University", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Mount Marty University", state: "SD", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },
  { universityName: "Northwestern College Iowa", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA / GPAC" },

  // --- NAIA KCAC ----------------------------------------------------------
  { universityName: "Bethany College Kansas", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Bethel College Kansas", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Friends University", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Kansas Wesleyan University", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "McPherson College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Oklahoma Wesleyan University", state: "OK", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Ottawa University", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Southwestern College Kansas", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Sterling College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "Tabor College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },
  { universityName: "University of Saint Mary", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA / KCAC" },

  // --- NJCAA top softball focus schools -----------------------------------
  { universityName: "Central Arizona College", state: "AZ", level: Division.NJCAA, conference: "NJCAA Region 1", tierLabel: "JUCO / D1" },
  { universityName: "Chipola College", state: "FL", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / D1" },
  { universityName: "College of Central Florida", state: "FL", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / D1" },
  { universityName: "Pasco-Hernando State College", state: "FL", level: Division.NJCAA, conference: "NJCAA Region 8", tierLabel: "JUCO / D1" },
  { universityName: "Salt Lake Community College", state: "UT", level: Division.NJCAA, conference: "NJCAA Region 18", tierLabel: "JUCO / D1" },
  { universityName: "Snow College", state: "UT", level: Division.NJCAA, conference: "NJCAA Region 18", tierLabel: "JUCO / D1" },
  { universityName: "Eastern Oklahoma State College", state: "OK", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / D1" },
  { universityName: "Murray State College", state: "OK", level: Division.NJCAA, conference: "NJCAA Region 2", tierLabel: "JUCO / D1" },
  { universityName: "Crowder College", state: "MO", level: Division.NJCAA, conference: "NJCAA Region 16", tierLabel: "JUCO / D1" },
  { universityName: "Wallace State Community College", state: "AL", level: Division.NJCAA, conference: "NJCAA Region 22", tierLabel: "JUCO / D1" },
  { universityName: "Shelton State Community College", state: "AL", level: Division.NJCAA, conference: "NJCAA Region 22", tierLabel: "JUCO / D1" },

  // --- JUCO CCCAA (California) -------------------------------------------
  { universityName: "Mt. San Antonio College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Palomar College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Orange Coast College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
  { universityName: "Sierra College", state: "CA", level: Division.NJCAA, conference: "California Community College Athletic Association", tierLabel: "JUCO / CCCAA" },
];

interface SeedStats {
  universitiesCreated: number;
  universitiesReused: number;
  programsCreated: number;
  programsSkipped: number;
  errors: { school: string; message: string }[];
}

async function findOrCreateUniversity(seed: SoftballSeed): Promise<{ id: string; created: boolean }> {
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

async function findOrCreateSoftballProgram(
  universityId: string,
  seed: SoftballSeed
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
  console.log(`🥎  Seeding ${SOFTBALL_PROGRAMS.length} major Softball programs…\n`);

  const stats: SeedStats = {
    universitiesCreated: 0,
    universitiesReused: 0,
    programsCreated: 0,
    programsSkipped: 0,
    errors: [],
  };

  for (const seed of SOFTBALL_PROGRAMS) {
    try {
      const u = await findOrCreateUniversity(seed);
      stats[u.created ? "universitiesCreated" : "universitiesReused"]++;
      const p = await findOrCreateSoftballProgram(u.id, seed);
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
  console.log(`Softball created:        ${stats.programsCreated}`);
  console.log(`Softball skipped:        ${stats.programsSkipped} (already existed)`);
  console.log(`Errors: ${stats.errors.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
