/**
 * scripts/refresh-university-theme.ts
 *
 * One-off fixer for when the curated INSPIRED_COLORS table changes and
 * we want the DB to catch up. Unlike scripts/seed-university-themes.ts
 * (which only fills NULLs and never overwrites), this script
 * FORCE-OVERWRITES the theme columns from the current table.
 *
 * Use when:
 *   - The published palette in school-inspired-colors.ts was corrected
 *     (e.g. Mt. SAC was wrong before; now we want the right value
 *     persisted, not just resolved at render time).
 *   - A school was reseeded with bad values from an older table.
 *
 * Usage:
 *   # Dry-run, single school by case-insensitive substring:
 *   npx tsx scripts/refresh-university-theme.ts "mt sac"
 *
 *   # Apply for real:
 *   npx tsx scripts/refresh-university-theme.ts "mt sac" --apply
 *
 *   # Multiple schools at once:
 *   npx tsx scripts/refresh-university-theme.ts "mt sac" "notre dame" --apply
 *
 *   # Refresh EVERY university that has a palette entry (nuclear option,
 *   # use after a wholesale table rewrite):
 *   npx tsx scripts/refresh-university-theme.ts --all --apply
 *
 * Matching: the script lower-cases both the DB name and the table keys
 * and does a substring match, so "mt sac" matches "Mt. San Antonio
 * College" if you also added "mt sac" as a key alias. When in doubt,
 * dry-run first — the script prints what it would write for each match.
 */
import { PrismaClient } from "@prisma/client";
import { INSPIRED_COLORS, type InspiredPalette } from "../src/lib/theme/school-inspired-colors";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const queries = args.filter((a) => !a.startsWith("--"));

if (!ALL && queries.length === 0) {
  console.error(
    "Usage: npx tsx scripts/refresh-university-theme.ts <name-substring>... [--apply]\n" +
      "       npx tsx scripts/refresh-university-theme.ts --all [--apply]"
  );
  process.exit(1);
}

function paletteFor(dbName: string): InspiredPalette | null {
  const key = dbName.trim().toLowerCase();
  if (INSPIRED_COLORS[key]) return INSPIRED_COLORS[key];
  // Fall back to substring match against the table — handles "Mt. San
  // Antonio College" → "mt sac" alias mismatch in either direction.
  for (const [tableKey, palette] of Object.entries(INSPIRED_COLORS)) {
    if (key.includes(tableKey) || tableKey.includes(key)) return palette;
  }
  return null;
}

async function main() {
  const universities = await prisma.university.findMany({
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

  const targets = ALL
    ? universities
    : universities.filter((u) => {
        const haystack = u.name.toLowerCase();
        return queries.some((q) => haystack.includes(q.toLowerCase()));
      });

  if (targets.length === 0) {
    console.log("No university rows matched.");
    return;
  }

  let updated = 0;
  let skippedNoPalette = 0;
  let unchanged = 0;

  for (const u of targets) {
    const palette = paletteFor(u.name);
    if (!palette) {
      console.log(`  - SKIP  ${u.name}: no palette entry`);
      skippedNoPalette++;
      continue;
    }
    const next = {
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      accentColor: palette.accent ?? palette.secondary,
      gradientFrom: palette.primary,
      gradientTo: palette.secondary,
    };
    const diff =
      u.primaryColor !== next.primaryColor ||
      u.secondaryColor !== next.secondaryColor ||
      u.accentColor !== next.accentColor ||
      u.gradientFrom !== next.gradientFrom ||
      u.gradientTo !== next.gradientTo;
    if (!diff) {
      console.log(`  · OK    ${u.name}: already matches table`);
      unchanged++;
      continue;
    }
    console.log(
      `  ${APPLY ? "✓" : "→"} ${u.name}: ${u.primaryColor ?? "null"} → ${next.primaryColor}`
    );
    if (APPLY) {
      await prisma.university.update({ where: { id: u.id }, data: next });
      updated++;
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Would apply"} ${
      APPLY ? updated : targets.length - unchanged - skippedNoPalette
    } update(s). Unchanged: ${unchanged}. Skipped (no palette): ${skippedNoPalette}.`
  );
  if (!APPLY) console.log("Re-run with --apply to commit.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
