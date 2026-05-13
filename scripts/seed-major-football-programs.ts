/**
 * Seed major football programs across every NCAA / NAIA / NJCAA tier.
 *
 * Conservative + idempotent:
 *   - University rows that already exist (matched by exact name OR slug) are
 *     reused — never overwritten.
 *   - Football School rows that already exist for that university are
 *     skipped — we never create a duplicate (universityId, "Football").
 *   - Coaches are NOT created here. The plan is to seed the program shell
 *     so the search/UI works, then attach verified coaches via the CSV
 *     importer once we've confirmed the head coach by name + source URL.
 *
 * Sport: Football only (Men's). Use the CSV importer for everything else.
 *
 * Usage:
 *   npm run seed:football-major
 *
 * Add new schools at the bottom of FOOTBALL_PROGRAMS — keep them grouped
 * by tier and conference so the diff is reviewable.
 */
import { PrismaClient, Division } from "@prisma/client";
import { normalizeSlug } from "../src/lib/normalize";

const prisma = new PrismaClient();

interface FootballSeed {
  universityName: string;
  city?: string;
  state?: string;
  websiteUrl?: string;
  athleticsWebsite?: string;
  level: Division;          // university-level division
  conference: string;       // football conference (may differ from school's basketball conference)
  tierLabel: string;        // free-text tag used in console output only
}

// ---------------------------------------------------------------------------
// Real, currently-active football programs only. Do not invent.
// Edit this list in PRs — each addition must be verified against an official
// athletics website or NCAA/NAIA/NJCAA conference page.
// ---------------------------------------------------------------------------
const FOOTBALL_PROGRAMS: FootballSeed[] = [
  // --- D1 FBS / Power 4 -----------------------------------------------------
  { universityName: "University of Alabama", state: "AL", level: Division.D1, conference: "SEC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://rolltide.com" },
  { universityName: "Auburn University", state: "AL", level: Division.D1, conference: "SEC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://auburntigers.com" },
  { universityName: "University of Georgia", state: "GA", level: Division.D1, conference: "SEC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://georgiadogs.com" },
  { universityName: "University of Florida", state: "FL", level: Division.D1, conference: "SEC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://floridagators.com" },
  { universityName: "University of Tennessee", state: "TN", level: Division.D1, conference: "SEC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://utsports.com" },
  { universityName: "Louisiana State University", state: "LA", level: Division.D1, conference: "SEC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://lsusports.net" },
  { universityName: "Texas A&M University", state: "TX", level: Division.D1, conference: "SEC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://12thman.com" },
  { universityName: "University of Texas at Austin", state: "TX", level: Division.D1, conference: "SEC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://texaslonghorns.com" },
  { universityName: "University of Oklahoma", state: "OK", level: Division.D1, conference: "SEC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://soonersports.com" },
  { universityName: "Ohio State University", state: "OH", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://ohiostatebuckeyes.com" },
  { universityName: "Penn State University", state: "PA", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://gopsusports.com" },
  { universityName: "University of Michigan", state: "MI", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://mgoblue.com" },
  { universityName: "Michigan State University", state: "MI", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://msuspartans.com" },
  { universityName: "University of Wisconsin-Madison", state: "WI", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://uwbadgers.com" },
  { universityName: "University of Iowa", state: "IA", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://hawkeyesports.com" },
  { universityName: "University of Minnesota", state: "MN", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://gophersports.com" },
  { universityName: "University of Illinois", state: "IL", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://fightingillini.com" },
  { universityName: "Indiana University", state: "IN", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://iuhoosiers.com" },
  { universityName: "Purdue University", state: "IN", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://purduesports.com" },
  { universityName: "University of Nebraska", state: "NE", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://huskers.com" },
  { universityName: "Northwestern University", state: "IL", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4" },
  { universityName: "Rutgers University-New Brunswick", state: "NJ", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://scarletknights.com" },
  { universityName: "University of Maryland", state: "MD", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4" },
  { universityName: "UCLA", state: "CA", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://uclabruins.com" },
  { universityName: "University of Southern California", state: "CA", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://usctrojans.com" },
  { universityName: "University of Oregon", state: "OR", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://goducks.com" },
  { universityName: "University of Washington", state: "WA", level: Division.D1, conference: "Big Ten", tierLabel: "FBS / Power 4", athleticsWebsite: "https://gohuskies.com" },
  { universityName: "Clemson University", state: "SC", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://clemsontigers.com" },
  { universityName: "Florida State University", state: "FL", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://seminoles.com" },
  { universityName: "University of Miami", state: "FL", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://miamihurricanes.com" },
  { universityName: "University of North Carolina at Chapel Hill", state: "NC", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://goheels.com" },
  { universityName: "North Carolina State University", state: "NC", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://gopack.com" },
  { universityName: "Duke University", state: "NC", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://goduke.com" },
  { universityName: "University of Pittsburgh", state: "PA", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://pittsburghpanthers.com" },
  { universityName: "Syracuse University", state: "NY", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://cuse.com" },
  { universityName: "Boston College", state: "MA", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://bceagles.com" },
  { universityName: "University of Louisville", state: "KY", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://gocards.com" },
  { universityName: "Southern Methodist University", state: "TX", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://smumustangs.com" },
  { universityName: "Stanford University", state: "CA", level: Division.D1, conference: "ACC", tierLabel: "FBS / Power 4", athleticsWebsite: "https://gostanford.com" },
  { universityName: "University of Notre Dame", state: "IN", level: Division.D1, conference: "Independent", tierLabel: "FBS / Power 4 (Independent)" },
  { universityName: "University of Kansas", state: "KS", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "Kansas State University", state: "KS", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "Oklahoma State University", state: "OK", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "Texas Tech University", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "Baylor University", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "Iowa State University", state: "IA", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "University of Cincinnati", state: "OH", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "University of Houston", state: "TX", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "University of Central Florida", state: "FL", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "Brigham Young University", state: "UT", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "West Virginia University", state: "WV", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "University of Colorado", state: "CO", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "University of Utah", state: "UT", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "University of Arizona", state: "AZ", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },
  { universityName: "Arizona State University", state: "AZ", level: Division.D1, conference: "Big 12", tierLabel: "FBS / Power 4" },

  // --- D1 FBS / G5 ----------------------------------------------------------
  { universityName: "University of Memphis", state: "TN", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "Tulane University", state: "LA", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "Temple University", state: "PA", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "University of South Florida", state: "FL", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "United States Naval Academy", state: "MD", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "United States Military Academy", state: "NY", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "University of Alabama at Birmingham", state: "AL", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "University of Tulsa", state: "OK", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "Rice University", state: "TX", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "University of Texas at San Antonio", state: "TX", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "Florida Atlantic University", state: "FL", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "East Carolina University", state: "NC", level: Division.D1, conference: "American Athletic Conference", tierLabel: "FBS / G5" },
  { universityName: "United States Air Force Academy", state: "CO", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "University of Hawaii at Manoa", state: "HI", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "University of Wyoming", state: "WY", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "Utah State University", state: "UT", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "Boise State University", state: "ID", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "San Diego State University", state: "CA", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "Fresno State University", state: "CA", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "Colorado State University", state: "CO", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "University of Nevada Las Vegas", state: "NV", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "University of Nevada Reno", state: "NV", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "University of New Mexico", state: "NM", level: Division.D1, conference: "Mountain West", tierLabel: "FBS / G5" },
  { universityName: "Western Michigan University", state: "MI", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "University of Toledo", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "Ball State University", state: "IN", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "Miami University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "Ohio University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "Northern Illinois University", state: "IL", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "University at Buffalo", state: "NY", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "University of Akron", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "Bowling Green State University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "Kent State University", state: "OH", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "University of Massachusetts Amherst", state: "MA", level: Division.D1, conference: "Mid-American Conference", tierLabel: "FBS / G5" },
  { universityName: "Coastal Carolina University", state: "SC", level: Division.D1, conference: "Sun Belt", tierLabel: "FBS / G5" },
  { universityName: "Old Dominion University", state: "VA", level: Division.D1, conference: "Sun Belt", tierLabel: "FBS / G5" },
  { universityName: "Marshall University", state: "WV", level: Division.D1, conference: "Sun Belt", tierLabel: "FBS / G5" },
  { universityName: "James Madison University", state: "VA", level: Division.D1, conference: "Sun Belt", tierLabel: "FBS / G5" },
  { universityName: "Appalachian State University", state: "NC", level: Division.D1, conference: "Sun Belt", tierLabel: "FBS / G5" },
  { universityName: "Texas State University", state: "TX", level: Division.D1, conference: "Sun Belt", tierLabel: "FBS / G5" },
  { universityName: "University of Louisiana at Lafayette", state: "LA", level: Division.D1, conference: "Sun Belt", tierLabel: "FBS / G5" },
  { universityName: "University of Louisiana at Monroe", state: "LA", level: Division.D1, conference: "Sun Belt", tierLabel: "FBS / G5" },
  { universityName: "Liberty University", state: "VA", level: Division.D1, conference: "Conference USA", tierLabel: "FBS / G5" },
  { universityName: "Western Kentucky University", state: "KY", level: Division.D1, conference: "Conference USA", tierLabel: "FBS / G5" },
  { universityName: "Middle Tennessee State University", state: "TN", level: Division.D1, conference: "Conference USA", tierLabel: "FBS / G5" },
  { universityName: "Sam Houston State University", state: "TX", level: Division.D1, conference: "Conference USA", tierLabel: "FBS / G5" },
  { universityName: "Jacksonville State University", state: "AL", level: Division.D1, conference: "Conference USA", tierLabel: "FBS / G5" },
  { universityName: "Kennesaw State University", state: "GA", level: Division.D1, conference: "Conference USA", tierLabel: "FBS / G5" },
  { universityName: "University of Delaware", state: "DE", level: Division.D1, conference: "Conference USA", tierLabel: "FBS / G5" },
  { universityName: "New Mexico State University", state: "NM", level: Division.D1, conference: "Conference USA", tierLabel: "FBS / G5" },
  { universityName: "University of Texas at El Paso", state: "TX", level: Division.D1, conference: "Conference USA", tierLabel: "FBS / G5" },
  { universityName: "University of Connecticut", state: "CT", level: Division.D1, conference: "Independent", tierLabel: "FBS / G5 (Independent)" },

  // --- D1 FCS ---------------------------------------------------------------
  { universityName: "Yale University", state: "CT", level: Division.D1, conference: "Ivy League", tierLabel: "FCS" },
  { universityName: "Princeton University", state: "NJ", level: Division.D1, conference: "Ivy League", tierLabel: "FCS" },
  { universityName: "Harvard University", state: "MA", level: Division.D1, conference: "Ivy League", tierLabel: "FCS" },
  { universityName: "Lehigh University", state: "PA", level: Division.D1, conference: "Patriot League", tierLabel: "FCS" },
  { universityName: "Lafayette College", state: "PA", level: Division.D1, conference: "Patriot League", tierLabel: "FCS" },
  { universityName: "College of the Holy Cross", state: "MA", level: Division.D1, conference: "Patriot League", tierLabel: "FCS" },
  { universityName: "Colgate University", state: "NY", level: Division.D1, conference: "Patriot League", tierLabel: "FCS" },
  { universityName: "North Dakota State University", state: "ND", level: Division.D1, conference: "Missouri Valley Football Conference", tierLabel: "FCS" },
  { universityName: "South Dakota State University", state: "SD", level: Division.D1, conference: "Missouri Valley Football Conference", tierLabel: "FCS" },
  { universityName: "University of North Dakota", state: "ND", level: Division.D1, conference: "Missouri Valley Football Conference", tierLabel: "FCS" },
  { universityName: "University of South Dakota", state: "SD", level: Division.D1, conference: "Missouri Valley Football Conference", tierLabel: "FCS" },
  { universityName: "University of Northern Iowa", state: "IA", level: Division.D1, conference: "Missouri Valley Football Conference", tierLabel: "FCS" },
  { universityName: "Illinois State University", state: "IL", level: Division.D1, conference: "Missouri Valley Football Conference", tierLabel: "FCS" },
  { universityName: "Indiana State University", state: "IN", level: Division.D1, conference: "Missouri Valley Football Conference", tierLabel: "FCS" },
  { universityName: "Murray State University", state: "KY", level: Division.D1, conference: "Missouri Valley Football Conference", tierLabel: "FCS" },
  { universityName: "Furman University", state: "SC", level: Division.D1, conference: "Southern Conference", tierLabel: "FCS" },
  { universityName: "Wofford College", state: "SC", level: Division.D1, conference: "Southern Conference", tierLabel: "FCS" },
  { universityName: "The Citadel", state: "SC", level: Division.D1, conference: "Southern Conference", tierLabel: "FCS" },
  { universityName: "Mercer University", state: "GA", level: Division.D1, conference: "Southern Conference", tierLabel: "FCS" },
  { universityName: "Western Carolina University", state: "NC", level: Division.D1, conference: "Southern Conference", tierLabel: "FCS" },
  { universityName: "Virginia Military Institute", state: "VA", level: Division.D1, conference: "Southern Conference", tierLabel: "FCS" },
  { universityName: "The College of William and Mary", state: "VA", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "FCS" },
  { universityName: "Towson University", state: "MD", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "FCS" },
  { universityName: "University of Richmond", state: "VA", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "FCS" },
  { universityName: "Stony Brook University", state: "NY", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "FCS" },
  { universityName: "Hampton University", state: "VA", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "FCS" },
  { universityName: "Bryant University", state: "RI", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "FCS" },
  { universityName: "Villanova University", state: "PA", level: Division.D1, conference: "Coastal Athletic Association", tierLabel: "FCS" },
  { universityName: "Tennessee State University", state: "TN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "FCS" },
  { universityName: "Tennessee Tech University", state: "TN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "FCS" },
  { universityName: "Eastern Illinois University", state: "IL", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "FCS" },
  { universityName: "University of Tennessee at Martin", state: "TN", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "FCS" },
  { universityName: "Lindenwood University", state: "MO", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "FCS" },
  { universityName: "Western Illinois University", state: "IL", level: Division.D1, conference: "Ohio Valley Conference", tierLabel: "FCS" },
  { universityName: "Florida A&M University", state: "FL", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Jackson State University", state: "MS", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Southern University", state: "LA", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Grambling State University", state: "LA", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Bethune-Cookman University", state: "FL", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Alabama State University", state: "AL", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Alabama A&M University", state: "AL", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Prairie View A&M University", state: "TX", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Texas Southern University", state: "TX", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Mississippi Valley State University", state: "MS", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "University of Arkansas at Pine Bluff", state: "AR", level: Division.D1, conference: "SWAC", tierLabel: "FCS" },
  { universityName: "Howard University", state: "DC", level: Division.D1, conference: "MEAC", tierLabel: "FCS" },
  { universityName: "Norfolk State University", state: "VA", level: Division.D1, conference: "MEAC", tierLabel: "FCS" },
  { universityName: "North Carolina A&T State University", state: "NC", level: Division.D1, conference: "MEAC", tierLabel: "FCS" },
  { universityName: "South Carolina State University", state: "SC", level: Division.D1, conference: "MEAC", tierLabel: "FCS" },
  { universityName: "Delaware State University", state: "DE", level: Division.D1, conference: "MEAC", tierLabel: "FCS" },
  { universityName: "University of Idaho", state: "ID", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "Idaho State University", state: "ID", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "Portland State University", state: "OR", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "California Polytechnic State University", state: "CA", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "University of California Davis", state: "CA", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "Weber State University", state: "UT", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "University of Northern Colorado", state: "CO", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "Sacramento State University", state: "CA", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "Eastern Washington University", state: "WA", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "Northern Arizona University", state: "AZ", level: Division.D1, conference: "Big Sky", tierLabel: "FCS" },
  { universityName: "McNeese State University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "FCS" },
  { universityName: "Nicholls State University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "FCS" },
  { universityName: "Southeastern Louisiana University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "FCS" },
  { universityName: "Northwestern State University", state: "LA", level: Division.D1, conference: "Southland Conference", tierLabel: "FCS" },
  { universityName: "Lamar University", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "FCS" },
  { universityName: "Houston Christian University", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "FCS" },
  { universityName: "University of the Incarnate Word", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "FCS" },
  { universityName: "East Texas A&M University", state: "TX", level: Division.D1, conference: "Southland Conference", tierLabel: "FCS" },
  { universityName: "Stephen F. Austin State University", state: "TX", level: Division.D1, conference: "United Athletic Conference", tierLabel: "FCS" },
  { universityName: "Tarleton State University", state: "TX", level: Division.D1, conference: "United Athletic Conference", tierLabel: "FCS" },
  { universityName: "University of North Alabama", state: "AL", level: Division.D1, conference: "United Athletic Conference", tierLabel: "FCS" },
  { universityName: "Eastern Kentucky University", state: "KY", level: Division.D1, conference: "United Athletic Conference", tierLabel: "FCS" },
  { universityName: "Austin Peay State University", state: "TN", level: Division.D1, conference: "United Athletic Conference", tierLabel: "FCS" },
  { universityName: "Abilene Christian University", state: "TX", level: Division.D1, conference: "United Athletic Conference", tierLabel: "FCS" },
  { universityName: "Southern Utah University", state: "UT", level: Division.D1, conference: "United Athletic Conference", tierLabel: "FCS" },
  { universityName: "Drake University", state: "IA", level: Division.D1, conference: "Pioneer Football League", tierLabel: "FCS" },
  { universityName: "University of Dayton", state: "OH", level: Division.D1, conference: "Pioneer Football League", tierLabel: "FCS" },
  { universityName: "Valparaiso University", state: "IN", level: Division.D1, conference: "Pioneer Football League", tierLabel: "FCS" },
  { universityName: "Butler University", state: "IN", level: Division.D1, conference: "Pioneer Football League", tierLabel: "FCS" },
  { universityName: "Morehead State University", state: "KY", level: Division.D1, conference: "Pioneer Football League", tierLabel: "FCS" },
  { universityName: "Stetson University", state: "FL", level: Division.D1, conference: "Pioneer Football League", tierLabel: "FCS" },
  { universityName: "Davidson College", state: "NC", level: Division.D1, conference: "Pioneer Football League", tierLabel: "FCS" },
  { universityName: "Presbyterian College", state: "SC", level: Division.D1, conference: "Pioneer Football League", tierLabel: "FCS" },
  { universityName: "Charleston Southern University", state: "SC", level: Division.D1, conference: "Big South Conference", tierLabel: "FCS" },
  { universityName: "Gardner-Webb University", state: "NC", level: Division.D1, conference: "Big South Conference", tierLabel: "FCS" },
  { universityName: "Robert Morris University", state: "PA", level: Division.D1, conference: "Big South Conference", tierLabel: "FCS" },
  { universityName: "Wagner College", state: "NY", level: Division.D1, conference: "Northeast Conference", tierLabel: "FCS" },
  { universityName: "Duquesne University", state: "PA", level: Division.D1, conference: "Northeast Conference", tierLabel: "FCS" },
  { universityName: "Saint Francis University", state: "PA", level: Division.D1, conference: "Northeast Conference", tierLabel: "FCS" },
  { universityName: "Sacred Heart University", state: "CT", level: Division.D1, conference: "Northeast Conference", tierLabel: "FCS" },
  { universityName: "Stonehill College", state: "MA", level: Division.D1, conference: "Northeast Conference", tierLabel: "FCS" },
  { universityName: "Long Island University", state: "NY", level: Division.D1, conference: "Northeast Conference", tierLabel: "FCS" },
  { universityName: "Merrimack College", state: "MA", level: Division.D1, conference: "Northeast Conference", tierLabel: "FCS" },

  // --- D2 -------------------------------------------------------------------
  { universityName: "Indiana University of Pennsylvania", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2" },
  { universityName: "Northwest Missouri State University", state: "MO", level: Division.D2, conference: "MIAA", tierLabel: "D2" },
  { universityName: "Wayne State University", state: "MI", level: Division.D2, conference: "GLIAC", tierLabel: "D2" },
  { universityName: "Minnesota State University Mankato", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2" },
  { universityName: "Henderson State University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2" },
  { universityName: "Harding University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2" },
  { universityName: "Ouachita Baptist University", state: "AR", level: Division.D2, conference: "Great American Conference", tierLabel: "D2" },
  { universityName: "Ashland University", state: "OH", level: Division.D2, conference: "G-MAC", tierLabel: "D2" },
  { universityName: "Kutztown University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2" },
  { universityName: "West Chester University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2" },
  { universityName: "Shippensburg University", state: "PA", level: Division.D2, conference: "PSAC", tierLabel: "D2" },
  { universityName: "Tuskegee University", state: "AL", level: Division.D2, conference: "SIAC", tierLabel: "D2" },
  { universityName: "Valdosta State University", state: "GA", level: Division.D2, conference: "Gulf South Conference", tierLabel: "D2" },
  { universityName: "Bemidji State University", state: "MN", level: Division.D2, conference: "NSIC", tierLabel: "D2" },
  { universityName: "University of Sioux Falls", state: "SD", level: Division.D2, conference: "NSIC", tierLabel: "D2" },
  { universityName: "Concord University", state: "WV", level: Division.D2, conference: "Mountain East Conference", tierLabel: "D2" },
  { universityName: "West Virginia State University", state: "WV", level: Division.D2, conference: "Mountain East Conference", tierLabel: "D2" },
  { universityName: "North Greenville University", state: "SC", level: Division.D2, conference: "Conference Carolinas", tierLabel: "D2" },
  { universityName: "Lenoir-Rhyne University", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2" },
  { universityName: "Wingate University", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2" },
  { universityName: "Carson-Newman University", state: "TN", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2" },
  { universityName: "Catawba College", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2" },
  { universityName: "Mars Hill University", state: "NC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2" },
  { universityName: "Limestone University", state: "SC", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2" },
  { universityName: "Lincoln Memorial University", state: "TN", level: Division.D2, conference: "South Atlantic Conference", tierLabel: "D2" },

  // --- D3 -------------------------------------------------------------------
  { universityName: "John Carroll University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3" },
  { universityName: "Marietta College", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3" },
  { universityName: "Otterbein University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3" },
  { universityName: "Ohio Northern University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3" },
  { universityName: "Capital University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3" },
  { universityName: "Heidelberg University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3" },
  { universityName: "Baldwin Wallace University", state: "OH", level: Division.D3, conference: "Ohio Athletic Conference", tierLabel: "D3" },
  { universityName: "Wabash College", state: "IN", level: Division.D3, conference: "NCAC", tierLabel: "D3" },
  { universityName: "DePauw University", state: "IN", level: Division.D3, conference: "NCAC", tierLabel: "D3" },
  { universityName: "Centre College", state: "KY", level: Division.D3, conference: "Southern Athletic Association", tierLabel: "D3" },
  { universityName: "Tufts University", state: "MA", level: Division.D3, conference: "NESCAC", tierLabel: "D3" },
  { universityName: "Bowdoin College", state: "ME", level: Division.D3, conference: "NESCAC", tierLabel: "D3" },
  { universityName: "Trinity College", state: "CT", level: Division.D3, conference: "NESCAC", tierLabel: "D3" },
  { universityName: "Wesleyan University", state: "CT", level: Division.D3, conference: "NESCAC", tierLabel: "D3" },
  { universityName: "Linfield University", state: "OR", level: Division.D3, conference: "Northwest Conference", tierLabel: "D3" },
  { universityName: "Wartburg College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3" },
  { universityName: "Central College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3" },
  { universityName: "Simpson College", state: "IA", level: Division.D3, conference: "American Rivers Conference", tierLabel: "D3" },
  { universityName: "Saint John's University MN", state: "MN", level: Division.D3, conference: "Minnesota Intercollegiate Athletic Conference", tierLabel: "D3" },
  { universityName: "University of Mary Hardin-Baylor", state: "TX", level: Division.D3, conference: "American Southwest Conference", tierLabel: "D3" },
  { universityName: "Hampden-Sydney College", state: "VA", level: Division.D3, conference: "ODAC", tierLabel: "D3" },
  { universityName: "Randolph-Macon College", state: "VA", level: Division.D3, conference: "ODAC", tierLabel: "D3" },

  // --- NAIA -----------------------------------------------------------------
  { universityName: "Northwestern College", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA" },
  { universityName: "The College of Idaho", state: "ID", level: Division.NAIA, conference: "Cascade Collegiate Conference", tierLabel: "NAIA" },
  { universityName: "Lindsey Wilson College", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA" },
  { universityName: "University of the Cumberlands", state: "KY", level: Division.NAIA, conference: "Mid-South Conference", tierLabel: "NAIA" },
  { universityName: "Grand View University", state: "IA", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA" },
  { universityName: "Marian University", state: "IN", level: Division.NAIA, conference: "Mid-States Football Association", tierLabel: "NAIA" },
  { universityName: "Olivet Nazarene University", state: "IL", level: Division.NAIA, conference: "Mid-States Football Association", tierLabel: "NAIA" },
  { universityName: "Hastings College", state: "NE", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA" },
  { universityName: "Dordt University", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA" },
  { universityName: "Keiser University", state: "FL", level: Division.NAIA, conference: "The Sun Conference", tierLabel: "NAIA" },
  { universityName: "Kansas Wesleyan University", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA" },
  { universityName: "Sterling College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA" },
  { universityName: "Ottawa University", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA" },
  { universityName: "Tabor College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA" },
  { universityName: "Friends University", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA" },
  { universityName: "MidAmerica Nazarene University", state: "KS", level: Division.NAIA, conference: "Heart of America Athletic Conference", tierLabel: "NAIA" },
  { universityName: "McPherson College", state: "KS", level: Division.NAIA, conference: "KCAC", tierLabel: "NAIA" },
  { universityName: "Doane University", state: "NE", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA" },
  { universityName: "Briar Cliff University", state: "IA", level: Division.NAIA, conference: "Great Plains Athletic Conference", tierLabel: "NAIA" },

  // --- NJCAA / JUCO ---------------------------------------------------------
  { universityName: "Hinds Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "NJCAA" },
  { universityName: "Jones College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "NJCAA" },
  { universityName: "Northwest Mississippi Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "NJCAA" },
  { universityName: "Pearl River Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "NJCAA" },
  { universityName: "Mississippi Gulf Coast Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "NJCAA" },
  { universityName: "Holmes Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "NJCAA" },
  { universityName: "Itawamba Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "NJCAA" },
  { universityName: "Copiah-Lincoln Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "NJCAA" },
  { universityName: "East Central Community College", state: "MS", level: Division.NJCAA, conference: "MACCC", tierLabel: "NJCAA" },
  { universityName: "Tyler Junior College", state: "TX", level: Division.NJCAA, conference: "SWJCFC", tierLabel: "NJCAA" },
  { universityName: "Trinity Valley Community College", state: "TX", level: Division.NJCAA, conference: "SWJCFC", tierLabel: "NJCAA" },
  { universityName: "Navarro College", state: "TX", level: Division.NJCAA, conference: "SWJCFC", tierLabel: "NJCAA" },
  { universityName: "Blinn College", state: "TX", level: Division.NJCAA, conference: "SWJCFC", tierLabel: "NJCAA" },
  { universityName: "Kilgore College", state: "TX", level: Division.NJCAA, conference: "SWJCFC", tierLabel: "NJCAA" },
  { universityName: "Cisco College", state: "TX", level: Division.NJCAA, conference: "SWJCFC", tierLabel: "NJCAA" },
  { universityName: "Garden City Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "NJCAA" },
  { universityName: "Independence Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "NJCAA" },
  { universityName: "Coffeyville Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "NJCAA" },
  { universityName: "Highland Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "NJCAA" },
  { universityName: "Dodge City Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "NJCAA" },
  { universityName: "Fort Scott Community College", state: "KS", level: Division.NJCAA, conference: "KJCCC", tierLabel: "NJCAA" },
  { universityName: "Iowa Central Community College", state: "IA", level: Division.NJCAA, conference: "ICCAC", tierLabel: "NJCAA" },
  { universityName: "Ellsworth Community College", state: "IA", level: Division.NJCAA, conference: "ICCAC", tierLabel: "NJCAA" },
  { universityName: "Snow College", state: "UT", level: Division.NJCAA, conference: "Scenic West Athletic Conference", tierLabel: "NJCAA" },
  { universityName: "Lackawanna College", state: "PA", level: Division.NJCAA, conference: "NJCAA", tierLabel: "NJCAA" },
  { universityName: "Northeastern Oklahoma A&M College", state: "OK", level: Division.NJCAA, conference: "NJCAA", tierLabel: "NJCAA" },
  { universityName: "Northern Oklahoma College", state: "OK", level: Division.NJCAA, conference: "NJCAA", tierLabel: "NJCAA" },

  // --- CCCAA (California Community College Athletic Association) -----------
  // CCCAA football schools share the SCFA conference label in our DB.
  { universityName: "Mt. San Antonio College", state: "CA", level: Division.NJCAA, conference: "Southern California Football Association", tierLabel: "CCCAA" },
  { universityName: "Riverside City College", state: "CA", level: Division.NJCAA, conference: "Southern California Football Association", tierLabel: "CCCAA" },
  { universityName: "Fullerton College", state: "CA", level: Division.NJCAA, conference: "Southern California Football Association", tierLabel: "CCCAA" },
  { universityName: "Pasadena City College", state: "CA", level: Division.NJCAA, conference: "Southern California Football Association", tierLabel: "CCCAA" },
];

interface SeedStats {
  universitiesCreated: number;
  universitiesReused: number;
  programsCreated: number;
  programsSkipped: number;
  errors: { school: string; message: string }[];
}

async function findOrCreateUniversity(seed: FootballSeed): Promise<{ id: string; created: boolean }> {
  const slug = normalizeSlug(seed.universityName);

  // Match by exact name first; fall back to slug if name doesn't match.
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

async function findOrCreateFootballProgram(
  universityId: string,
  seed: FootballSeed
): Promise<{ created: boolean }> {
  // School uniqueness key is (universityId, sport). We treat the existence of
  // a row as the source of truth — never overwrite.
  const existing = await prisma.school.findUnique({
    where: { universityId_sport: { universityId, sport: "Football" } },
    select: { id: true },
  });
  if (existing) return { created: false };

  await prisma.school.create({
    data: {
      universityId,
      sport: "Football",
      division: seed.level,
      conference: seed.conference,
      athleticsUrl: seed.athleticsWebsite ?? null,
    },
  });
  return { created: true };
}

async function main() {
  console.log(`🏈  Seeding ${FOOTBALL_PROGRAMS.length} major football programs…\n`);

  const stats: SeedStats = {
    universitiesCreated: 0,
    universitiesReused: 0,
    programsCreated: 0,
    programsSkipped: 0,
    errors: [],
  };

  for (const seed of FOOTBALL_PROGRAMS) {
    try {
      const u = await findOrCreateUniversity(seed);
      stats[u.created ? "universitiesCreated" : "universitiesReused"]++;
      const p = await findOrCreateFootballProgram(u.id, seed);
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
  console.log(`Universities created:  ${stats.universitiesCreated}`);
  console.log(`Universities reused:   ${stats.universitiesReused}`);
  console.log(`Football programs created: ${stats.programsCreated}`);
  console.log(`Football programs skipped: ${stats.programsSkipped} (already existed)`);
  console.log(`Errors: ${stats.errors.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
