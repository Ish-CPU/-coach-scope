import fs from "fs";
import csv from "csv-parser";
import { PrismaClient } from "@prisma/client";

console.log("IMPORT SCRIPT STARTED");
console.log("CSV FILE:", process.argv[2]);

const prisma = new PrismaClient();
const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npx tsx scripts/import-dorms.ts path/to/dorms.csv");
  process.exit(1);
}

/**
 * Normalize a CSV cell: trim, treat "" as null.
 * Returns null for undefined/non-strings so optional fields stay clean.
 */
function clean(value?: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parse an integer safely. Empty / non-numeric values (e.g. "2025-2026")
 * become null instead of NaN, which would otherwise break the Prisma write.
 */
function parseIntSafe(value?: string): number | null {
  const s = clean(value);
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

type CsvRow = Record<string, string | undefined>;

async function main() {
  // -------------------------------------------------------------
  // 1. Load the full CSV into memory. Fine at this scale (~4k rows).
  // -------------------------------------------------------------
  const rows: CsvRow[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .on("error", reject)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });
  console.log(`Rows loaded: ${rows.length}`);

  // -------------------------------------------------------------
  // 2. Collect every unique universityName referenced in the CSV,
  //    then resolve them all to IDs in ONE round-trip instead of
  //    one findFirst per row.
  // -------------------------------------------------------------
  const universityNames = new Set<string>();
  for (const row of rows) {
    const n = clean(row.universityName);
    if (n) universityNames.add(n);
  }
  console.log(`Unique universities referenced: ${universityNames.size}`);

  const universities = await prisma.university.findMany({
    where: { name: { in: Array.from(universityNames) } },
    select: { id: true, name: true },
  });
  const universityIdByName = new Map<string, string>();
  for (const u of universities) universityIdByName.set(u.name, u.id);
  console.log(
    `Universities matched in DB: ${universities.length}/${universityNames.size}`
  );

  const unmatched = Array.from(universityNames).filter(
    (n) => !universityIdByName.has(n)
  );
  if (unmatched.length > 0) {
    console.log(`Unmatched universities (${unmatched.length}):`);
    for (const u of unmatched.slice(0, 20)) console.log(`  - ${u}`);
    if (unmatched.length > 20)
      console.log(`  ... and ${unmatched.length - 20} more`);
  }

  // -------------------------------------------------------------
  // 3. Pre-fetch every existing dorm for those universities in ONE
  //    round-trip. Build a (universityId, slug) and (universityId,
  //    name) lookup so per-row dedupe is in memory.
  // -------------------------------------------------------------
  const universityIds = Array.from(universityIdByName.values());
  const existingDorms = await prisma.dorm.findMany({
    where: { universityId: { in: universityIds } },
    select: { id: true, universityId: true, name: true, slug: true },
  });
  // key format: `${universityId}|slug:${slug}` or `${universityId}|name:${name}`
  const dormIdByKey = new Map<string, string>();
  for (const d of existingDorms) {
    if (d.slug) dormIdByKey.set(`${d.universityId}|slug:${d.slug}`, d.id);
    dormIdByKey.set(`${d.universityId}|name:${d.name}`, d.id);
  }
  console.log(`Existing dorms loaded for dedupe: ${existingDorms.length}`);

  // -------------------------------------------------------------
  // 4. Walk the rows. Each row = at most one write. Progress every
  //    100 rows so you can see the script isn't hung. Per-row errors
  //    are caught and logged so a single bad row doesn't abort the
  //    whole 4k-row import.
  // -------------------------------------------------------------
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const t0 = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = clean(row.name);
    const slug = clean(row.slug);
    const universityName = clean(row.universityName);

    if (!name || !slug || !universityName) {
      skipped++;
      continue;
    }

    const universityId = universityIdByName.get(universityName);
    if (!universityId) {
      // Universe of unmatched names was already logged in step 2.
      skipped++;
      continue;
    }

    const existingId =
      dormIdByKey.get(`${universityId}|slug:${slug}`) ??
      dormIdByKey.get(`${universityId}|name:${name}`);

    const data = {
      name,
      slug,
      universityId,
      city: clean(row.city),
      state: clean(row.state),
      roomType: clean(row.roomType),
      bathroomType: clean(row.bathroomType),
      yearBuilt: parseIntSafe(row.yearBuilt),
      capacity: parseIntSafe(row.capacity),
      officialPageUrl: clean(row.officialPageUrl),
      description: clean(row.description),
      imageUrl: clean(row.imageUrl),
      sourceUrl: clean(row.sourceUrl),
      sourceName: clean(row.sourceName),
      // seasonYear is String? in the schema (e.g. "2025-2026").
      // The previous version did Number(...) which turned it into NaN.
      seasonYear: clean(row.seasonYear),
      lastVerifiedAt: new Date(),
    };

    try {
      if (existingId) {
        await prisma.dorm.update({ where: { id: existingId }, data });
        updated++;
      } else {
        const newDorm = await prisma.dorm.create({ data });
        created++;
        // Keep the in-memory dedupe cache fresh so a later row
        // referencing the same dorm doesn't double-insert.
        dormIdByKey.set(`${universityId}|slug:${slug}`, newDorm.id);
        dormIdByKey.set(`${universityId}|name:${name}`, newDorm.id);
      }
    } catch (err) {
      errors++;
      console.error(
        `Row ${i + 1} (${universityName} / ${name}) failed:`,
        err instanceof Error ? err.message : err
      );
    }

    if ((i + 1) % 100 === 0 || i === rows.length - 1) {
      const elapsedSec = (Date.now() - t0) / 1000;
      const rate = elapsedSec > 0 ? ((i + 1) / elapsedSec).toFixed(1) : "—";
      console.log(
        `  ${i + 1}/${rows.length}  ` +
          `(created=${created} updated=${updated} skipped=${skipped} errors=${errors}) ` +
          `${elapsedSec.toFixed(1)}s @ ${rate} rows/s`
      );
    }
  }

  console.log("Dorm import complete:");
  console.log({ created, updated, skipped, errors });
}

main()
  .catch((error) => {
    console.error("IMPORT FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
