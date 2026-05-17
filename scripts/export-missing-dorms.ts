/**
 * scripts/export-missing-dorms.ts
 *
 * Coverage report for the dorm catalog. Writes a CSV of every university
 * that has ZERO dorms in the database, so a researcher (or batched AI
 * pass) can fill them in from official Housing / Residence Life pages.
 *
 * Output:
 *   data/exports/missing-dorms.csv
 *
 * Columns (header row included):
 *   universityName, city, state, websiteUrl, housingUrl, dormCount
 *
 * dormCount is always 0 in this export — included so the file can be
 * re-used as a coverage worksheet without manually re-counting.
 *
 * Sorted alphabetically by `state, name` so the same university lands at
 * the same row across runs; researchers diff CSVs to spot newly added
 * universities since the last export.
 *
 * Workflow:
 *   1.  npm run dorms:missing
 *       (this script — writes the worksheet)
 *   2.  Open data/exports/missing-dorms.csv.
 *   3.  For each row, visit the university's housingUrl (or look one up
 *       on websiteUrl) and harvest the residence halls list from the
 *       official housing page. NEVER invent dorm names.
 *   4.  Build a dorms CSV in the format documented at
 *       src/lib/import-csv.ts (`DormRow`):
 *
 *         name,slug,universityName,city,state,roomType,bathroomType,
 *         yearBuilt,capacity,officialPageUrl,description,imageUrl,
 *         sourceUrl,sourceName,seasonYear,lastVerifiedAt
 *
 *       Only `name` and `universityName` are required.
 *   5.  Upload via /admin/import (type: dorms) or run
 *         npm run db:import -- dorms path/to/file.csv
 *       The importer is idempotent — re-uploads update existing rows
 *       and never duplicate or delete dorms.
 *   6.  Re-run this script. Universities that now have dorms drop off
 *       the worksheet.
 *
 * Usage:
 *   npm run dorms:missing
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

const OUT_DIR = join("data", "exports");
const OUT_PATH = join(OUT_DIR, "missing-dorms.csv");

/**
 * Minimal CSV escape: wrap in quotes when the cell contains a comma,
 * quote, or newline; double any internal quotes per RFC 4180. Numbers
 * pass through as their string representation.
 */
function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s === "") return "";
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  // Pull universities + their dorm count via groupBy. _count is cheap
  // at this scale (low thousands of universities); avoids loading every
  // dorm row into memory.
  const [universitiesTotal, universities] = await Promise.all([
    prisma.university.count(),
    prisma.university.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        websiteUrl: true,
        housingUrl: true,
        _count: { select: { dorms: true } },
      },
      orderBy: [{ state: "asc" }, { name: "asc" }],
    }),
  ]);

  const missing = universities.filter((u) => u._count.dorms === 0);
  const withDorms = universities.length - missing.length;

  // Quick stats on stdout so the script doubles as a coverage report.
  // eslint-disable-next-line no-console
  console.log("=== Dorm coverage ===");
  console.log(`  Universities total:        ${universitiesTotal}`);
  console.log(`  Universities with dorms:   ${withDorms}`);
  console.log(`  Universities missing dorms: ${missing.length}`);
  const totalDorms = await prisma.dorm.count();
  console.log(`  Total dorms in DB:         ${totalDorms}`);
  console.log("");

  mkdirSync(OUT_DIR, { recursive: true });

  const header = [
    "universityName",
    "city",
    "state",
    "websiteUrl",
    "housingUrl",
    "dormCount",
  ].join(",");

  const lines = [header];
  for (const u of missing) {
    lines.push(
      [
        csvCell(u.name),
        csvCell(u.city),
        csvCell(u.state),
        csvCell(u.websiteUrl),
        csvCell(u.housingUrl),
        csvCell(u._count.dorms),
      ].join(",")
    );
  }

  writeFileSync(OUT_PATH, lines.join("\n") + "\n", "utf-8");

  console.log(`Wrote ${missing.length} rows to ${OUT_PATH}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Open the CSV and research each university's official");
  console.log("     Housing / Residence Life page for the residence halls list.");
  console.log("  2. Build a dorms CSV — header: name,slug,universityName,city,");
  console.log("     state,roomType,bathroomType,yearBuilt,capacity,officialPageUrl,");
  console.log("     description,imageUrl,sourceUrl,sourceName,seasonYear,lastVerifiedAt");
  console.log("  3. Upload at /admin/import (type: dorms) — idempotent, never");
  console.log("     duplicates, never deletes existing dorms.");
  console.log("  4. Re-run `npm run dorms:missing` to see updated coverage.");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[export-missing-dorms] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
