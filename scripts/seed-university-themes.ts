/**
 * scripts/seed-university-themes.ts
 *
 * Optional one-shot script that copies entries from the curated
 * INSPIRED_COLORS table into the University rows for any school whose
 * theme fields are currently null. Existing values are never overwritten —
 * admin-set colors win, period.
 *
 * Why "optional": getUniversityTheme() already falls back to the
 * INSPIRED_COLORS lookup at render time, so a university with NULL theme
 * columns will still appear themed in the UI. Running this script just
 * promotes those values into the DB so they're:
 *   - visible to the admin UI (eventual feature)
 *   - exportable
 *   - queryable for "how many universities have a theme assigned"
 *
 * Idempotent: re-running only touches rows that still have null colors.
 *
 * Usage:
 *   npx tsx scripts/seed-university-themes.ts            # dry-run, prints summary
 *   npx tsx scripts/seed-university-themes.ts --apply    # actually writes
 *
 * Legal note: see src/lib/theme/school-inspired-colors.ts. The table
 * contains each school's actual brand colors — colors alone aren't
 * trademarked. Official logos, mascots, and wordmarks are never used.
 *
 * Note: this script only fills NULLs. If the curated table changes and
 * you want existing rows updated to match, use
 * scripts/refresh-university-theme.ts instead — it force-overwrites.
 */
import { PrismaClient } from "@prisma/client";
import { INSPIRED_COLORS } from "../src/lib/theme/school-inspired-colors";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  // Pull every university that's missing AT LEAST ONE theme field. We
  // process partial assignments too — admin may have set primaryColor
  // by hand but left the rest blank, in which case we backfill only the
  // blanks (never overwrite).
  const universities = await prisma.university.findMany({
    where: {
      OR: [
        { primaryColor: null },
        { secondaryColor: null },
        { accentColor: null },
        { gradientFrom: null },
        { gradientTo: null },
      ],
    },
    select: {
      id: true,
      name: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      gradientFrom: true,
      gradientTo: true,
    },
  });

  let matched = 0;
  let updated = 0;
  let skippedNoMatch = 0;

  for (const u of universities) {
    const palette = INSPIRED_COLORS[u.name.trim().toLowerCase()];
    if (!palette) {
      skippedNoMatch++;
      continue;
    }
    matched++;

    // Only fill in nulls — preserves any admin overrides.
    const patch: Record<string, string> = {};
    if (!u.primaryColor) patch.primaryColor = palette.primary;
    if (!u.secondaryColor) patch.secondaryColor = palette.secondary;
    if (!u.accentColor && palette.accent) patch.accentColor = palette.accent;
    if (!u.gradientFrom) patch.gradientFrom = palette.primary;
    if (!u.gradientTo) patch.gradientTo = palette.secondary;
    if (Object.keys(patch).length === 0) continue;

    if (APPLY) {
      await prisma.university.update({ where: { id: u.id }, data: patch });
    }
    updated++;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[seed-university-themes] universities scanned: ${universities.length}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `[seed-university-themes] matched in INSPIRED_COLORS: ${matched}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `[seed-university-themes] would-update: ${updated} (${APPLY ? "APPLIED" : "dry-run, pass --apply to write"})`
  );
  // eslint-disable-next-line no-console
  console.log(
    `[seed-university-themes] no inspired palette: ${skippedNoMatch} (will fall back at render time)`
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[seed-university-themes] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
