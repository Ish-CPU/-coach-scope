/**
 * scripts/add-uri-st-thomas-football.ts
 *
 * Adds two FCS football programs to the DB:
 *   - University of Rhode Island Rams (Coastal Athletic Association)
 *   - University of St. Thomas Tommies — MN (Pioneer Football League)
 *
 * For each:
 *   1. Upsert the University row
 *   2. Upsert the football School (program) row
 *   3. Seed the 8 position-coach placeholders (same set as every other
 *      football program — see scripts/seed-football-position-coaches.ts)
 *
 * Head coach is intentionally NOT inserted — we don't have authoritative
 * current names and inventing data is worse than leaving it blank. You
 * can add the real head coach later via:
 *   - npx tsx scripts/import-coaches.ts <coaches.csv>
 *   - or directly in the admin UI once the Members page ships
 *
 * IDEMPOTENT — safe to rerun.
 *
 * Usage:
 *   npx tsx scripts/add-uri-st-thomas-football.ts           # dry-run
 *   npx tsx scripts/add-uri-st-thomas-football.ts --apply   # write
 */
import { Division, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Same 8 positions seeded across every football program. Mirrors
// scripts/seed-football-position-coaches.ts so the new schools fit the
// existing UX (Head Coach / Coaching Staff split + the coach-page
// "More coaches at this program" nav).
const POSITIONS: { name: string; title: string }[] = [
  { name: "Quarterbacks Coach",   title: "Position Coach" },
  { name: "Running Backs Coach",  title: "Position Coach" },
  { name: "Wide Receivers Coach", title: "Position Coach" },
  { name: "Tight Ends Coach",     title: "Position Coach" },
  { name: "Offensive Line Coach", title: "Position Coach" },
  { name: "Defensive Line Coach", title: "Position Coach" },
  { name: "Linebackers Coach",    title: "Position Coach" },
  { name: "Cornerbacks Coach",    title: "Position Coach" },
];

interface SchoolSeed {
  universityName: string;
  city: string;
  state: string;
  websiteUrl: string;
  athleticsWebsite: string;
  level: Division;
  // Football conference (may differ from overall athletic conference).
  conference: string;
  tierLabel: string;
}

const NEW_SCHOOLS: SchoolSeed[] = [
  {
    universityName: "University of Rhode Island",
    city: "Kingston",
    state: "RI",
    websiteUrl: "https://www.uri.edu",
    athleticsWebsite: "https://gorhody.com",
    // Schema's Division enum is broad — D1 includes both FBS and FCS.
    // Both URI and St. Thomas football are FCS programs.
    level: Division.D1,
    conference: "Coastal Athletic Association",
    tierLabel: "FCS",
  },
  {
    universityName: "University of St. Thomas",
    city: "St. Paul",
    state: "MN",
    websiteUrl: "https://www.stthomas.edu",
    athleticsWebsite: "https://tommiesports.com",
    // Schema's Division enum is broad — D1 includes both FBS and FCS.
    // Both URI and St. Thomas football are FCS programs.
    level: Division.D1,
    conference: "Pioneer Football League",
    tierLabel: "FCS",
  },
];

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

interface Stats {
  universitiesCreated: number;
  universitiesReused: number;
  programsCreated: number;
  programsReused: number;
  positionCoachesCreated: number;
  positionCoachesSkipped: number;
}

async function main() {
  console.log(`\n🏈  URI + St. Thomas football seed — ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  const stats: Stats = {
    universitiesCreated: 0,
    universitiesReused: 0,
    programsCreated: 0,
    programsReused: 0,
    positionCoachesCreated: 0,
    positionCoachesSkipped: 0,
  };

  for (const seed of NEW_SCHOOLS) {
    console.log(`— ${seed.universityName} (${seed.city}, ${seed.state})`);
    const slug = normalizeSlug(seed.universityName);

    // 1. University.
    let university = await prisma.university.findFirst({
      where: { OR: [{ name: seed.universityName }, { slug }] },
      select: { id: true, name: true },
    });
    if (university) {
      console.log(`  · uni already exists — reusing`);
      stats.universitiesReused++;
    } else {
      console.log(`  ${APPLY ? "✓" : "→"} CREATE university`);
      if (APPLY) {
        const created = await prisma.university.create({
          data: {
            name: seed.universityName,
            slug,
            city: seed.city,
            state: seed.state,
            country: "USA",
            level: seed.level,
            conference: seed.conference,
            websiteUrl: seed.websiteUrl,
            athleticsWebsite: seed.athleticsWebsite,
          },
          select: { id: true, name: true },
        });
        university = created;
      } else {
        // Dry-run placeholder so position-coach loop has something to
        // anchor against in the printed output.
        university = { id: `dry-run:${seed.universityName}`, name: seed.universityName };
      }
      stats.universitiesCreated++;
    }

    // 2. Football School (program).
    if (!APPLY && university.id.startsWith("dry-run:")) {
      console.log(`  → CREATE Football program (${seed.conference}, ${seed.tierLabel})`);
      stats.programsCreated++;
    } else {
      const existingProgram = await prisma.school.findUnique({
        where: { universityId_sport: { universityId: university.id, sport: "Football" } },
        select: { id: true },
      });
      let programId: string;
      if (existingProgram) {
        console.log(`  · Football program already exists — reusing`);
        stats.programsReused++;
        programId = existingProgram.id;
      } else {
        const created = await prisma.school.create({
          data: {
            universityId: university.id,
            sport: "Football",
            division: seed.level,
            conference: seed.conference,
            athleticsUrl: seed.athleticsWebsite,
          },
          select: { id: true },
        });
        console.log(`  ✓ CREATE Football program (${seed.conference})`);
        stats.programsCreated++;
        programId = created.id;
      }

      // 3. Position-coach placeholders.
      for (const pos of POSITIONS) {
        const existing = await prisma.coach.findUnique({
          where: { schoolId_name: { schoolId: programId, name: pos.name } },
          select: { id: true },
        });
        if (existing) {
          stats.positionCoachesSkipped++;
          continue;
        }
        await prisma.coach.create({
          data: {
            schoolId: programId,
            name: pos.name,
            title: pos.title,
            seasonYear: "2025-2026",
            lastVerifiedAt: new Date(),
          },
        });
        stats.positionCoachesCreated++;
      }
      console.log(
        `  ${APPLY ? "✓" : "→"} position coaches: created=${stats.positionCoachesCreated}, skipped=${stats.positionCoachesSkipped} (cumulative)`
      );
    }

    console.log("");
  }

  console.log("━━━ Summary ━━━");
  console.log(`Universities created: ${stats.universitiesCreated}`);
  console.log(`Universities reused:  ${stats.universitiesReused}`);
  console.log(`Programs created:     ${stats.programsCreated}`);
  console.log(`Programs reused:      ${stats.programsReused}`);
  console.log(`Position coaches created: ${stats.positionCoachesCreated}`);
  console.log(`Position coaches skipped: ${stats.positionCoachesSkipped}`);
  if (!APPLY) console.log("\nDry-run complete. Re-run with --apply to commit.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
