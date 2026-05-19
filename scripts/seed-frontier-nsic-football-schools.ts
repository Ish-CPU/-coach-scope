/**
 * scripts/seed-frontier-nsic-football-schools.ts
 *
 * Conference-alignment update (2025-26): the NAIA Frontier Conference
 * absorbed the four NSAA football schools (Valley City State, Dickinson
 * State, Dakota State, Mayville State) when the NSAA wound down football
 * sponsorship. Separately, the University of Jamestown moved football
 * from NAIA up to NCAA Division II in the NSIC.
 *
 * This script adds / updates those five universities + their football
 * program rows + their theme colors. It is idempotent and safe to rerun.
 *
 * RULES
 *   - University rows matched by exact `name` (preferred) or `slug`.
 *     Existing rows are UPDATED in-place (city/state/website/level/
 *     conference/theme columns) — we never delete or wipe fields.
 *   - Football School rows keyed by (universityId, sport="Football").
 *     Existing rows have their `division` + `conference` + `athleticsUrl`
 *     refreshed to match the seed; nothing else is touched, so any
 *     reviews / connections / coaches stay attached.
 *   - Reviews, dorms, coaches, groups, users, athlete connections, and
 *     student connections are NEVER deleted by this script.
 *   - No fake dorm rows are created. Dorm coverage is tracked via
 *     `University.housingUrl`; that column is left null when we don't
 *     have a verified housing-page URL (we never invent URLs).
 *   - Groups: this script does NOT create groups directly. The
 *     `seed-groups.ts` script (run separately) is the canonical
 *     idempotent backfill that creates UNIVERSITY / PROGRAM / RECRUITING
 *     groups for every uni + school row. After this script, run
 *     `npm run seed:groups` (or `npx tsx scripts/seed-groups.ts`) to
 *     create the matching groups for the five new/updated rows.
 *   - Theme colors are pulled from src/lib/theme/school-inspired-colors.ts
 *     (which has accurate brand colors — colors aren't trademarked).
 *
 * USAGE
 *   # Dry run — prints intended changes, writes nothing:
 *   npx tsx scripts/seed-frontier-nsic-football-schools.ts
 *
 *   # Commit:
 *   npx tsx scripts/seed-frontier-nsic-football-schools.ts --apply
 *
 *   # After applying, refresh groups (canonical script):
 *   npm run seed:groups
 */
import { Division, PrismaClient } from "@prisma/client";
import { normalizeSlug } from "../src/lib/normalize";
import { INSPIRED_COLORS } from "../src/lib/theme/school-inspired-colors";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// ---------------------------------------------------------------------------
// Seed data — five schools only. Single source of truth in this file.
// ---------------------------------------------------------------------------

interface SchoolSeed {
  /** Canonical name as stored in University.name (used for upsert match). */
  universityName: string;
  city: string;
  state: string;
  websiteUrl: string;
  /** Optional, only set when we have a verified URL. */
  athleticsWebsite?: string;
  /** University-level division. Football-specific level lives on School. */
  level: Division;
  /** Football conference for this school. */
  conference: string;
  /** Free-form tier tag for console output only. */
  tierLabel: string;
  /** Notes attached to the console summary for traceability. */
  notes: string;
}

const SCHOOL_SEEDS: SchoolSeed[] = [
  // ---- NAIA Frontier Conference (formerly NSAA football) ----------------
  {
    universityName: "Valley City State University",
    city: "Valley City",
    state: "ND",
    websiteUrl: "https://www.vcsu.edu",
    level: Division.NAIA,
    conference: "Frontier Conference",
    tierLabel: "NAIA",
    notes: "Former NSAA football member; now aligned with Frontier Conference.",
  },
  {
    universityName: "Dickinson State University",
    city: "Dickinson",
    state: "ND",
    websiteUrl: "https://dickinsonstate.edu",
    level: Division.NAIA,
    conference: "Frontier Conference",
    tierLabel: "NAIA",
    notes: "Former NSAA football member; now aligned with Frontier Conference.",
  },
  {
    universityName: "Dakota State University",
    city: "Madison",
    state: "SD",
    websiteUrl: "https://dsu.edu",
    level: Division.NAIA,
    conference: "Frontier Conference",
    tierLabel: "NAIA",
    notes: "Former NSAA football member; now aligned with Frontier Conference.",
  },
  {
    universityName: "Mayville State University",
    city: "Mayville",
    state: "ND",
    websiteUrl: "https://mayvillestate.edu",
    level: Division.NAIA,
    conference: "Frontier Conference",
    tierLabel: "NAIA",
    notes: "Former NSAA football member; now aligned with Frontier Conference.",
  },

  // ---- NCAA Division II / NSIC -----------------------------------------
  {
    universityName: "University of Jamestown",
    city: "Jamestown",
    state: "ND",
    websiteUrl: "https://www.uj.edu",
    // Jamestown is moving from NAIA → NCAA D-II and joining NSIC. The
    // user-level row reflects the destination tier so they show up
    // correctly in division filters.
    level: Division.D2,
    conference: "Northern Sun Intercollegiate Conference",
    tierLabel: "D2",
    notes: "Moving from NAIA to NCAA Division II / NSIC.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paletteFor(name: string) {
  return INSPIRED_COLORS[name.trim().toLowerCase()] ?? null;
}

type ThemePatch = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
};

/** Build the theme-color patch only if the school has a curated palette. */
function themePatchFor(name: string): ThemePatch {
  const palette = paletteFor(name);
  if (!palette) return {};
  return {
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    accentColor: palette.accent ?? palette.secondary,
    gradientFrom: palette.primary,
    gradientTo: palette.secondary,
  };
}

interface Stats {
  universitiesCreated: number;
  universitiesUpdated: number;
  programsCreated: number;
  programsUpdated: number;
  dormPlaceholdersCreated: number;
  dormPlaceholdersUpdated: number;
  conferencesAffected: Set<string>;
  skipped: { name: string; reason: string }[];
}

async function upsertUniversity(
  seed: SchoolSeed,
  stats: Stats
): Promise<{ id: string; created: boolean } | null> {
  const slug = normalizeSlug(seed.universityName);
  const theme = themePatchFor(seed.universityName);

  // Find by name first, then by slug — never by ID (we don't have one yet).
  const existing = await prisma.university.findFirst({
    where: {
      OR: [
        { name: seed.universityName },
        ...(slug ? [{ slug }] : []),
      ],
    },
    select: {
      id: true,
      city: true,
      state: true,
      websiteUrl: true,
      athleticsWebsite: true,
      level: true,
      conference: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      gradientFrom: true,
      gradientTo: true,
    },
  });

  if (existing) {
    // Build an UPDATE patch — only refresh fields that the seed actually
    // sets and where the current value is null OR differs from the seed.
    // Existing non-null fields that match the seed are left alone; manual
    // admin edits to other columns (description, imageUrl, etc.) are
    // never touched.
    const patch: Record<string, string | Division | null | undefined> = {};
    if (existing.city !== seed.city) patch.city = seed.city;
    if (existing.state !== seed.state) patch.state = seed.state;
    if (existing.websiteUrl !== seed.websiteUrl) patch.websiteUrl = seed.websiteUrl;
    if (seed.athleticsWebsite && existing.athleticsWebsite !== seed.athleticsWebsite) {
      patch.athleticsWebsite = seed.athleticsWebsite;
    }
    if (existing.level !== seed.level) patch.level = seed.level;
    if (existing.conference !== seed.conference) patch.conference = seed.conference;
    // Theme columns: only fill blanks (never overwrite admin choices).
    if (theme.primaryColor && !existing.primaryColor) patch.primaryColor = theme.primaryColor;
    if (theme.secondaryColor && !existing.secondaryColor) patch.secondaryColor = theme.secondaryColor;
    if (theme.accentColor && !existing.accentColor) patch.accentColor = theme.accentColor;
    if (theme.gradientFrom && !existing.gradientFrom) patch.gradientFrom = theme.gradientFrom;
    if (theme.gradientTo && !existing.gradientTo) patch.gradientTo = theme.gradientTo;

    if (Object.keys(patch).length === 0) {
      console.log(`  · UNI    ${seed.universityName} — already up to date`);
      return { id: existing.id, created: false };
    }
    console.log(
      `  ${APPLY ? "✓" : "→"} UNI    ${seed.universityName} — patch: ${Object.keys(patch).join(", ")}`
    );
    if (APPLY) {
      await prisma.university.update({ where: { id: existing.id }, data: patch });
    }
    stats.universitiesUpdated++;
    return { id: existing.id, created: false };
  }

  // CREATE path — brand new row.
  console.log(`  ${APPLY ? "✓" : "→"} UNI    ${seed.universityName} — CREATE (${seed.state}, ${seed.tierLabel})`);
  if (!APPLY) {
    stats.universitiesCreated++;
    // Return a placeholder id so downstream dry-run logs render; nothing
    // is actually inserted while not applying.
    return { id: `dry-run:${seed.universityName}`, created: true };
  }
  const created = await prisma.university.create({
    data: {
      name: seed.universityName,
      slug: slug ?? undefined,
      city: seed.city,
      state: seed.state,
      country: "USA",
      level: seed.level,
      conference: seed.conference,
      websiteUrl: seed.websiteUrl,
      athleticsWebsite: seed.athleticsWebsite ?? null,
      // Theme columns from the curated palette (or undefined if no entry).
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      accentColor: theme.accentColor,
      gradientFrom: theme.gradientFrom,
      gradientTo: theme.gradientTo,
    },
    select: { id: true },
  });
  stats.universitiesCreated++;
  return { id: created.id, created: true };
}

async function upsertFootballProgram(
  universityId: string,
  seed: SchoolSeed,
  stats: Stats
): Promise<void> {
  // Unique key on School is (universityId, sport). We always store the
  // football sport as the canonical string "Football".
  if (!APPLY && universityId.startsWith("dry-run:")) {
    console.log(`  → SCHL   ${seed.universityName} football — would create (${seed.conference}, ${seed.level})`);
    stats.programsCreated++;
    stats.conferencesAffected.add(seed.conference);
    return;
  }

  const existing = await prisma.school.findUnique({
    where: { universityId_sport: { universityId, sport: "Football" } },
    select: {
      id: true,
      division: true,
      conference: true,
      athleticsUrl: true,
    },
  });

  if (existing) {
    const patch: Record<string, string | Division | null | undefined> = {};
    if (existing.division !== seed.level) patch.division = seed.level;
    if (existing.conference !== seed.conference) patch.conference = seed.conference;
    if (seed.athleticsWebsite && existing.athleticsUrl !== seed.athleticsWebsite) {
      patch.athleticsUrl = seed.athleticsWebsite;
    }
    if (Object.keys(patch).length === 0) {
      console.log(`  · SCHL   ${seed.universityName} football — already up to date`);
      return;
    }
    console.log(
      `  ${APPLY ? "✓" : "→"} SCHL   ${seed.universityName} football — patch: ${Object.keys(patch).join(", ")}`
    );
    if (APPLY) {
      await prisma.school.update({ where: { id: existing.id }, data: patch });
    }
    stats.programsUpdated++;
    stats.conferencesAffected.add(seed.conference);
    return;
  }

  console.log(`  ${APPLY ? "✓" : "→"} SCHL   ${seed.universityName} football — CREATE (${seed.conference})`);
  if (APPLY) {
    await prisma.school.create({
      data: {
        universityId,
        sport: "Football",
        division: seed.level,
        conference: seed.conference,
        athleticsUrl: seed.athleticsWebsite ?? null,
      },
    });
  }
  stats.programsCreated++;
  stats.conferencesAffected.add(seed.conference);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `\n🏈  Frontier Conference + NSIC football alignment seed — ${SCHOOL_SEEDS.length} schools`
  );
  console.log(`    mode: ${APPLY ? "APPLY (writing changes)" : "DRY-RUN (no writes)"}\n`);

  const stats: Stats = {
    universitiesCreated: 0,
    universitiesUpdated: 0,
    programsCreated: 0,
    programsUpdated: 0,
    dormPlaceholdersCreated: 0,
    dormPlaceholdersUpdated: 0,
    conferencesAffected: new Set<string>(),
    skipped: [],
  };

  for (const seed of SCHOOL_SEEDS) {
    try {
      console.log(`\n— ${seed.universityName} (${seed.notes})`);
      const u = await upsertUniversity(seed, stats);
      if (!u) {
        stats.skipped.push({ name: seed.universityName, reason: "no university id" });
        continue;
      }
      await upsertFootballProgram(u.id, seed, stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌  ${seed.universityName}: ${message}`);
      stats.skipped.push({ name: seed.universityName, reason: message });
    }
  }

  console.log("\n━━━ Summary ━━━");
  console.log(`Universities created:        ${stats.universitiesCreated}`);
  console.log(`Universities updated:        ${stats.universitiesUpdated}`);
  console.log(`Football programs created:   ${stats.programsCreated}`);
  console.log(`Football programs updated:   ${stats.programsUpdated}`);
  console.log(`Dorm placeholders created:   ${stats.dormPlaceholdersCreated}  (intentionally 0 — see header note)`);
  console.log(`Dorm placeholders updated:   ${stats.dormPlaceholdersUpdated}  (intentionally 0 — see header note)`);
  console.log(
    `Conference records affected: ${stats.conferencesAffected.size}  (${[...stats.conferencesAffected].join(", ")})`
  );
  console.log(`Skipped:                     ${stats.skipped.length}`);
  for (const s of stats.skipped) console.log(`  - ${s.name}: ${s.reason}`);

  if (!APPLY) {
    console.log("\nDry-run complete. Re-run with --apply to commit.");
  } else {
    console.log("\nDone. Next step: `npm run seed:groups` to create matching UNIVERSITY / PROGRAM / RECRUITING groups for the new rows.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
