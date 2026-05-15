/**
 * Seed GLIAC conference coverage (universities + per-sport programs).
 *
 * Idempotent + conservative:
 *   - Universities matched by exact name OR slug. Existing rows are reused
 *     and NEVER overwritten.
 *   - Programs (School rows) are looked up by `(universityId, sport)`. If
 *     the row already exists we only patch *missing* fields:
 *       - `division`   → set to D2 if currently the default but not GLIAC-tagged
 *       - `conference` → set to "GLIAC" if currently null
 *       - `athleticsUrl` → set if currently null
 *       - `seasonYear` → set to "2025-2026" if currently null
 *     Existing non-null values stay untouched.
 *   - NO coaches are created here. Use the CSV importer once head coaches
 *     are verified against the official athletics site.
 *
 * Per-school sport sponsorship reflects each athletics department's actual
 * varsity teams (e.g. Michigan Tech and Northern Michigan don't sponsor
 * baseball; Lake Superior State doesn't sponsor football; GVSU dropped
 * men's soccer; etc.). Sports the school doesn't field are intentionally
 * omitted — we don't create empty placeholder programs.
 *
 * Usage:
 *   npm run seed:gliac-programs
 */
import { PrismaClient, Division } from "@prisma/client";
import { normalizeSlug } from "../src/lib/normalize";

const prisma = new PrismaClient();

const CONFERENCE = "GLIAC";
const DIVISION = Division.D2;
const SEASON_YEAR = "2025-2026";

// Canonical sport labels — must match the rest of the platform exactly
// (case, apostrophes, possessive form). The CSV importer + every other
// seed script use these same strings, so renaming here would silently
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
  /** Optional sport-specific URL on the school's athletics site. */
  athleticsUrl?: string;
}

interface SchoolSpec {
  universityName: string;
  city: string;
  state: string;
  /** Conference-level homepage. Used as the University-level athletics site. */
  athleticsWebsite: string;
  /** Programs the school actually fields. Sports they don't sponsor are omitted. */
  programs: ProgramSpec[];
}

// ---------------------------------------------------------------------------
// GLIAC schools and the sports each one actually sponsors (2025-2026).
//
// Sports omitted from any given school = school does NOT sponsor that sport
// at varsity level per its current athletics website. Do NOT add a sport
// here unless you've verified it's on the live roster.
// ---------------------------------------------------------------------------
const GLIAC: SchoolSpec[] = [
  {
    universityName: "Grand Valley State University",
    city: "Allendale",
    state: "MI",
    athleticsWebsite: "https://gvsulakers.com",
    programs: [
      { sport: SPORT.FOOTBALL,   athleticsUrl: "https://gvsulakers.com/sports/football" },
      { sport: SPORT.BASEBALL,   athleticsUrl: "https://gvsulakers.com/sports/baseball" },
      { sport: SPORT.SOFTBALL,   athleticsUrl: "https://gvsulakers.com/sports/softball" },
      { sport: SPORT.MBB,        athleticsUrl: "https://gvsulakers.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://gvsulakers.com/sports/womens-basketball" },
      // GVSU does NOT sponsor men's soccer at varsity level — intentionally omitted.
      { sport: SPORT.WSOC,       athleticsUrl: "https://gvsulakers.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "Ferris State University",
    city: "Big Rapids",
    state: "MI",
    athleticsWebsite: "https://ferrisstatebulldogs.com",
    programs: [
      { sport: SPORT.FOOTBALL,   athleticsUrl: "https://ferrisstatebulldogs.com/sports/football" },
      { sport: SPORT.BASEBALL,   athleticsUrl: "https://ferrisstatebulldogs.com/sports/baseball" },
      { sport: SPORT.SOFTBALL,   athleticsUrl: "https://ferrisstatebulldogs.com/sports/softball" },
      { sport: SPORT.MBB,        athleticsUrl: "https://ferrisstatebulldogs.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://ferrisstatebulldogs.com/sports/womens-basketball" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://ferrisstatebulldogs.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "Saginaw Valley State University",
    city: "University Center",
    state: "MI",
    athleticsWebsite: "https://svsucardinals.com",
    programs: [
      { sport: SPORT.FOOTBALL,   athleticsUrl: "https://svsucardinals.com/sports/football" },
      { sport: SPORT.BASEBALL,   athleticsUrl: "https://svsucardinals.com/sports/baseball" },
      { sport: SPORT.SOFTBALL,   athleticsUrl: "https://svsucardinals.com/sports/softball" },
      { sport: SPORT.MBB,        athleticsUrl: "https://svsucardinals.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://svsucardinals.com/sports/womens-basketball" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://svsucardinals.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "Wayne State University",
    city: "Detroit",
    state: "MI",
    athleticsWebsite: "https://wsuathletics.com",
    programs: [
      { sport: SPORT.FOOTBALL,   athleticsUrl: "https://wsuathletics.com/sports/football" },
      { sport: SPORT.BASEBALL,   athleticsUrl: "https://wsuathletics.com/sports/baseball" },
      { sport: SPORT.SOFTBALL,   athleticsUrl: "https://wsuathletics.com/sports/softball" },
      { sport: SPORT.MBB,        athleticsUrl: "https://wsuathletics.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://wsuathletics.com/sports/womens-basketball" },
      { sport: SPORT.MSOC,       athleticsUrl: "https://wsuathletics.com/sports/mens-soccer" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://wsuathletics.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "Davenport University",
    city: "Grand Rapids",
    state: "MI",
    athleticsWebsite: "https://dupanthers.com",
    programs: [
      { sport: SPORT.FOOTBALL,   athleticsUrl: "https://dupanthers.com/sports/football" },
      { sport: SPORT.BASEBALL,   athleticsUrl: "https://dupanthers.com/sports/baseball" },
      { sport: SPORT.SOFTBALL,   athleticsUrl: "https://dupanthers.com/sports/softball" },
      { sport: SPORT.MBB,        athleticsUrl: "https://dupanthers.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://dupanthers.com/sports/womens-basketball" },
      { sport: SPORT.MSOC,       athleticsUrl: "https://dupanthers.com/sports/mens-soccer" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://dupanthers.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "Michigan Tech University",
    city: "Houghton",
    state: "MI",
    athleticsWebsite: "https://michigantechhuskies.com",
    programs: [
      { sport: SPORT.FOOTBALL,   athleticsUrl: "https://michigantechhuskies.com/sports/football" },
      // Michigan Tech does NOT sponsor varsity baseball or softball.
      { sport: SPORT.MBB,        athleticsUrl: "https://michigantechhuskies.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://michigantechhuskies.com/sports/womens-basketball" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://michigantechhuskies.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "Northern Michigan University",
    city: "Marquette",
    state: "MI",
    athleticsWebsite: "https://nmuwildcats.com",
    programs: [
      { sport: SPORT.FOOTBALL,   athleticsUrl: "https://nmuwildcats.com/sports/football" },
      // NMU does NOT sponsor varsity baseball or softball.
      { sport: SPORT.MBB,        athleticsUrl: "https://nmuwildcats.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://nmuwildcats.com/sports/womens-basketball" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://nmuwildcats.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "Lake Superior State University",
    city: "Sault Ste. Marie",
    state: "MI",
    athleticsWebsite: "https://lssuathletics.com",
    programs: [
      // Lake Superior State does NOT sponsor varsity football.
      { sport: SPORT.BASEBALL,   athleticsUrl: "https://lssuathletics.com/sports/baseball" },
      { sport: SPORT.SOFTBALL,   athleticsUrl: "https://lssuathletics.com/sports/softball" },
      { sport: SPORT.MBB,        athleticsUrl: "https://lssuathletics.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://lssuathletics.com/sports/womens-basketball" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://lssuathletics.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "Purdue University Northwest",
    city: "Hammond",
    state: "IN",
    athleticsWebsite: "https://pnwathletics.com",
    programs: [
      // Purdue Northwest does NOT sponsor varsity football.
      { sport: SPORT.BASEBALL,   athleticsUrl: "https://pnwathletics.com/sports/baseball" },
      { sport: SPORT.SOFTBALL,   athleticsUrl: "https://pnwathletics.com/sports/softball" },
      { sport: SPORT.MBB,        athleticsUrl: "https://pnwathletics.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://pnwathletics.com/sports/womens-basketball" },
      { sport: SPORT.MSOC,       athleticsUrl: "https://pnwathletics.com/sports/mens-soccer" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://pnwathletics.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "University of Wisconsin-Parkside",
    city: "Kenosha",
    state: "WI",
    athleticsWebsite: "https://parksideathletics.com",
    programs: [
      // Wisconsin-Parkside does NOT sponsor varsity football.
      { sport: SPORT.BASEBALL,   athleticsUrl: "https://parksideathletics.com/sports/baseball" },
      { sport: SPORT.SOFTBALL,   athleticsUrl: "https://parksideathletics.com/sports/softball" },
      { sport: SPORT.MBB,        athleticsUrl: "https://parksideathletics.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://parksideathletics.com/sports/womens-basketball" },
      { sport: SPORT.MSOC,       athleticsUrl: "https://parksideathletics.com/sports/mens-soccer" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://parksideathletics.com/sports/womens-soccer" },
    ],
  },
  {
    universityName: "Roosevelt University",
    city: "Chicago",
    state: "IL",
    athleticsWebsite: "https://rooseveltlakers.com",
    programs: [
      // Roosevelt does NOT sponsor varsity football.
      { sport: SPORT.BASEBALL,   athleticsUrl: "https://rooseveltlakers.com/sports/baseball" },
      { sport: SPORT.SOFTBALL,   athleticsUrl: "https://rooseveltlakers.com/sports/softball" },
      { sport: SPORT.MBB,        athleticsUrl: "https://rooseveltlakers.com/sports/mens-basketball" },
      { sport: SPORT.WBB,        athleticsUrl: "https://rooseveltlakers.com/sports/womens-basketball" },
      { sport: SPORT.MSOC,       athleticsUrl: "https://rooseveltlakers.com/sports/mens-soccer" },
      { sport: SPORT.WSOC,       athleticsUrl: "https://rooseveltlakers.com/sports/womens-soccer" },
    ],
  },
];

interface SeedStats {
  universitiesCreated: number;
  universitiesReused: number;
  programsCreated: number;
  programsSkipped: number;
  programsPatched: number;
  errors: { school: string; sport?: string; message: string }[];
}

async function findOrCreateUniversity(school: SchoolSpec): Promise<{ id: string; created: boolean }> {
  const slug = normalizeSlug(school.universityName);

  const existing = await prisma.university.findFirst({
    where: {
      OR: [{ name: school.universityName }, slug ? { slug } : undefined].filter(
        (x): x is { name: string } | { slug: string } => Boolean(x)
      ),
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await prisma.university.create({
    data: {
      name: school.universityName,
      slug: slug ?? undefined,
      city: school.city,
      state: school.state,
      country: "USA",
      level: DIVISION,
      conference: CONFERENCE,
      athleticsWebsite: school.athleticsWebsite,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

/**
 * Result codes for the per-program upsert path. We surface "patched" as a
 * distinct outcome from "skipped" so the operator can see how many existing
 * rows just had their missing metadata back-filled.
 */
type ProgramResult = "created" | "skipped" | "patched";

async function findOrCreateGliacProgram(
  universityId: string,
  program: ProgramSpec
): Promise<ProgramResult> {
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
        division: DIVISION,
        conference: CONFERENCE,
        athleticsUrl: program.athleticsUrl ?? null,
        seasonYear: SEASON_YEAR,
      },
    });
    return "created";
  }

  // Patch only missing fields. Never overwrite a non-null value the operator
  // may have set deliberately (e.g. a coach already linked a sport-specific
  // URL we don't know about).
  const patch: {
    division?: Division;
    conference?: string;
    athleticsUrl?: string;
    seasonYear?: string;
  } = {};

  // Treat the schema default (D1) as effectively-unset for GLIAC programs
  // — every GLIAC member is D2.
  if (existing.division !== Division.D2) {
    patch.division = Division.D2;
  }
  if (!existing.conference) patch.conference = CONFERENCE;
  if (!existing.athleticsUrl && program.athleticsUrl) {
    patch.athleticsUrl = program.athleticsUrl;
  }
  if (!existing.seasonYear) patch.seasonYear = SEASON_YEAR;

  if (Object.keys(patch).length === 0) return "skipped";

  await prisma.school.update({
    where: { id: existing.id },
    data: patch,
  });
  return "patched";
}

async function main() {
  const totalPrograms = GLIAC.reduce((acc, s) => acc + s.programs.length, 0);
  console.log(
    `🏟️  Seeding ${GLIAC.length} GLIAC universities and ${totalPrograms} sport programs…\n`
  );

  const stats: SeedStats = {
    universitiesCreated: 0,
    universitiesReused: 0,
    programsCreated: 0,
    programsSkipped: 0,
    programsPatched: 0,
    errors: [],
  };

  for (const school of GLIAC) {
    let universityId: string;
    try {
      const u = await findOrCreateUniversity(school);
      universityId = u.id;
      stats[u.created ? "universitiesCreated" : "universitiesReused"]++;
      console.log(
        `${u.created ? "✅  created university" : "♻️   reused university"}: ${school.universityName}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stats.errors.push({ school: school.universityName, message });
      console.error(`❌  university failed (${school.universityName}): ${message}`);
      continue;
    }

    for (const program of school.programs) {
      try {
        const outcome = await findOrCreateGliacProgram(universityId, program);
        if (outcome === "created") {
          stats.programsCreated++;
          console.log(`   ✅  created program: ${school.universityName} — ${program.sport}`);
        } else if (outcome === "patched") {
          stats.programsPatched++;
          console.log(`   🔧  patched program: ${school.universityName} — ${program.sport} (back-filled missing metadata)`);
        } else {
          stats.programsSkipped++;
          console.log(`   ⏭️   skipped program: ${school.universityName} — ${program.sport} (already complete)`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        stats.errors.push({ school: school.universityName, sport: program.sport, message });
        console.error(
          `   ❌  program failed (${school.universityName} — ${program.sport}): ${message}`
        );
      }
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Universities created:    ${stats.universitiesCreated}`);
  console.log(`Universities reused:     ${stats.universitiesReused}`);
  console.log(`Programs created:        ${stats.programsCreated}`);
  console.log(`Programs patched:        ${stats.programsPatched}  (existing rows back-filled with missing division/conference/url/season)`);
  console.log(`Programs skipped:        ${stats.programsSkipped}  (already complete)`);
  console.log(`Errors:                  ${stats.errors.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
