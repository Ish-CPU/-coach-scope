/**
 * scripts/import-coaches.ts
 *
 * Generic coach CSV importer. For the football-specific safer flow that
 * writes missing-data CSV reports, see scripts/connect-football-coaches.ts.
 *
 * SCHEMA REMINDERS (these are why the old version had TS errors):
 *   - Coach has NO `universityId`         → link via `schoolId`
 *   - Coach has NO `sport` column         → sport lives on the related School
 *   - Coach has NO `officialPageUrl`      → the field is `officialProfileUrl`
 *                                            (`officialPageUrl` is on Dorm)
 *   - @@unique([schoolId, name])          → upsert key
 *
 * The CSV's `sport` column is used only to RESOLVE which School row to
 * attach the coach to. It is never written onto Coach.
 *
 * CSV columns (header row required):
 *   name, slug, universityName, sport, title|role,
 *   officialProfileUrl|officialPageUrl, sourceUrl, sourceName,
 *   seasonYear, lastVerifiedAt
 *
 * Usage:
 *   npx tsx scripts/import-coaches.ts path/to/coaches.csv
 */
import fs from "fs";
import csv from "csv-parser";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npx tsx scripts/import-coaches.ts path/to/coaches.csv");
  process.exit(1);
}

function clean(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function hostOf(urlString: string | null): string | null {
  if (!urlString) return null;
  try {
    return new URL(urlString).host;
  } catch {
    return null;
  }
}

// CSV row is typed loosely — csv-parser yields all-string objects.
interface CoachRow {
  name?: string;
  slug?: string;
  universityName?: string;
  sport?: string;
  title?: string;
  role?: string;                  // CSV alias for `title`
  officialProfileUrl?: string;
  officialPageUrl?: string;       // legacy CSV alias
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
  gender?: string;
}

async function main() {
  const rows: CoachRow[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .on("error", reject)
      .pipe(csv())
      .on("data", (row: CoachRow) => rows.push(row))
      .on("end", () => resolve())
      .on("error", reject);
  });

  console.log(`Rows loaded: ${rows.length}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const universityName = clean(row.universityName);
      const name = clean(row.name);
      const sport = clean(row.sport);
      const slug = clean(row.slug);

      // sport is required so we can find the right program. universityName
      // and name are required so we can resolve + key the upsert.
      if (!universityName || !name || !sport) {
        skipped++;
        continue;
      }

      // 1. Resolve the University row.
      const university = await prisma.university.findFirst({
        where: { name: universityName },
        select: { id: true },
      });
      if (!university) {
        console.log(`University not found: ${universityName}`);
        skipped++;
        continue;
      }

      // 2. Resolve the School row — Coach attaches to School, NOT University.
      const school = await prisma.school.findUnique({
        where: { universityId_sport: { universityId: university.id, sport } },
        select: { id: true },
      });
      if (!school) {
        console.log(`${sport} program not found at ${universityName} — seed the program first`);
        skipped++;
        continue;
      }

      // 3. Build the Coach payload using ONLY real Coach columns.
      //    No `universityId` (doesn't exist). No `sport` (lives on School).
      //    Use `officialProfileUrl`, not `officialPageUrl`.
      const sourceUrl = clean(row.sourceUrl);
      const data = {
        name,
        slug: slug ?? undefined,
        title: clean(row.title) ?? clean(row.role) ?? "Head Coach",
        gender: clean(row.gender),
        officialProfileUrl:
          clean(row.officialProfileUrl) ?? clean(row.officialPageUrl),
        sourceUrl,
        sourceName: clean(row.sourceName) ?? hostOf(sourceUrl),
        seasonYear: clean(row.seasonYear),
        lastVerifiedAt: new Date(),
        schoolId: school.id,
      };

      // 4. Upsert keyed on (schoolId, name) — Coach's real unique constraint.
      const existing = await prisma.coach.findUnique({
        where: { schoolId_name: { schoolId: school.id, name } },
        select: { id: true },
      });

      if (existing) {
        await prisma.coach.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.coach.create({ data });
        created++;
      }
    } catch (error) {
      console.error("Coach import error:", error);
      errors++;
    }
  }

  console.log("Coach import complete:");
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
