/**
 * scripts/connect-football-coaches.ts
 *
 * Safer, football-specific coach connector. Reads coach rows from
 * Data/Imports/coaches.csv (or a path you pass in), filters to Football
 * only, and attaches each coach to the right School row.
 *
 * UNLIKE the generic CSV importer this script will NEVER:
 *   - create fake universities
 *   - create fake School / program rows
 *   - invent dorm names
 *   - crash on a missing dependency
 *
 * Instead, when a dependency is missing, the row is appended to a
 * `Data/exports/missing-*.csv` file with the right header so you can
 * open it, fill in the gaps, and feed it back into the normal import
 * pipeline.
 *
 * SCHEMA REMINDERS (verified against prisma/schema.prisma):
 *   - Coach has columns:     name, slug, title, gender, schoolId, bio,
 *                            imageUrl, sourceUrl, officialProfileUrl,
 *                            sourceName, seasonYear, lastVerifiedAt
 *   - Coach.@@unique([schoolId, name])  ← upsert key
 *   - Coach does NOT have: universityId, sport, officialPageUrl
 *     (those names sometimes appear in CSVs — they're remapped on read)
 *   - School.@@unique([universityId, sport])
 *   - University.name @unique
 *
 * USAGE
 *   # Dry-run (no DB writes). Always writes the missing-*.csv reports.
 *   npx tsx scripts/connect-football-coaches.ts ./Data/Imports/coaches.csv
 *
 *   # Apply (upsert coach rows for real).
 *   npx tsx scripts/connect-football-coaches.ts ./Data/Imports/coaches.csv --apply
 *
 * EXPECTED CSV HEADERS — both naming conventions accepted:
 *   name, slug, universityName, sport,
 *   gender, role|title, level|division, conference,
 *   officialProfileUrl|officialPageUrl, sourceUrl, sourceName,
 *   city, state, seasonYear, lastVerifiedAt
 */
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const filePath = process.argv[2] ?? "./Data/Imports/coaches.csv";
const APPLY = process.argv.includes("--apply");

if (!fs.existsSync(filePath)) {
  console.error(`Input file not found: ${filePath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clean(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseDate(value?: string | null): Date | null {
  const s = clean(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hostOf(urlString: string | null): string | null {
  if (!urlString) return null;
  try {
    return new URL(urlString).host;
  } catch {
    return null;
  }
}

/** CSV-safe escape: wrap in quotes if the value contains "," | "\"" | newline. */
function csvCell(value: string | null | undefined): string {
  const s = value ?? "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath: string, header: string[], rows: string[][]): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const body = [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n";
  fs.writeFileSync(filePath, body, "utf8");
}

// ---------------------------------------------------------------------------
// CSV row type — accept both column naming conventions.
// ---------------------------------------------------------------------------

interface CoachRow {
  name?: string;
  slug?: string;
  universityName?: string;
  sport?: string;
  gender?: string;
  role?: string;
  title?: string;
  level?: string;
  division?: string;
  conference?: string;
  officialProfileUrl?: string;
  officialPageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  city?: string;
  state?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

// ---------------------------------------------------------------------------
// The five schools we always seed example/template CSVs for, regardless of
// whether anything is missing. Lets you keep one canonical reference file
// for the Frontier + NSIC alignment work.
// ---------------------------------------------------------------------------

interface ReferenceSchool {
  name: string;
  city: string;
  state: string;
  websiteUrl: string;
  level: string;          // matches Division enum string
  conference: string;
}

const REFERENCE_SCHOOLS: ReferenceSchool[] = [
  { name: "Valley City State University", city: "Valley City", state: "ND", websiteUrl: "https://www.vcsu.edu",        level: "NAIA", conference: "Frontier Conference" },
  { name: "Dickinson State University",   city: "Dickinson",   state: "ND", websiteUrl: "https://dickinsonstate.edu", level: "NAIA", conference: "Frontier Conference" },
  { name: "Dakota State University",      city: "Madison",     state: "SD", websiteUrl: "https://dsu.edu",            level: "NAIA", conference: "Frontier Conference" },
  { name: "Mayville State University",    city: "Mayville",    state: "ND", websiteUrl: "https://mayvillestate.edu", level: "NAIA", conference: "Frontier Conference" },
  { name: "University of Jamestown",      city: "Jamestown",   state: "ND", websiteUrl: "https://www.uj.edu",         level: "D2",   conference: "Northern Sun Intercollegiate Conference" },
];

// ---------------------------------------------------------------------------
// Output paths + canonical headers (mirror the project's seed templates).
// ---------------------------------------------------------------------------

const OUT_DIR = "./Data/exports";

const UNI_HEADER = [
  "name", "slug", "city", "state", "country", "level", "conference",
  "officialWebsite", "athleticsWebsite", "sourceUrl", "seasonYear", "lastVerifiedAt",
];

const SCHOOL_HEADER = [
  "universityName", "sport", "division", "conference", "description",
  "athleticsUrl", "sourceUrl", "sourceName", "seasonYear", "lastVerifiedAt",
];

const DORM_HEADER = [
  "name", "slug", "universityName", "city", "state",
  "roomType", "bathroomType", "yearBuilt", "capacity", "officialPageUrl",
  "description", "imageUrl", "sourceUrl", "sourceName", "seasonYear", "lastVerifiedAt",
];

const SEASON_YEAR = "2025-2026";
const TODAY_ISO = new Date().toISOString().slice(0, 10);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Stats {
  rowsLoaded: number;
  rowsNonFootball: number;
  coachesCreated: number;
  coachesUpdated: number;
  coachesUnchanged: number;
  universitiesMissing: number;
  programsMissing: number;
  dormCoverageMissing: number;
  skipped: number;
  errors: number;
}

async function main() {
  console.log(`\n🏈  connect-football-coaches`);
  console.log(`    input:  ${filePath}`);
  console.log(`    mode:   ${APPLY ? "APPLY (writing changes)" : "DRY-RUN (no DB writes)"}\n`);

  // --- 1. Load CSV ----------------------------------------------------------
  const rows: CoachRow[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .on("error", reject)
      .pipe(csv())
      .on("data", (row: CoachRow) => rows.push(row))
      .on("end", () => resolve())
      .on("error", reject);
  });

  const stats: Stats = {
    rowsLoaded: rows.length,
    rowsNonFootball: 0,
    coachesCreated: 0,
    coachesUpdated: 0,
    coachesUnchanged: 0,
    universitiesMissing: 0,
    programsMissing: 0,
    dormCoverageMissing: 0,
    skipped: 0,
    errors: 0,
  };

  // Track what we've already reported so each missing dep is logged once.
  const missingUniversitiesSet = new Set<string>();
  const missingSchoolsSet = new Set<string>();        // key: "name|sport"
  const missingDormsSet = new Set<string>();          // key: universityName
  const missingUniversityRows: string[][] = [];
  const missingSchoolRows: string[][] = [];
  const missingDormRows: string[][] = [];

  // Cache university lookups so re-scanning the same name is one DB hit.
  const uniCache = new Map<string, { id: string; name: string } | null>();

  async function findUniversity(name: string) {
    if (uniCache.has(name)) return uniCache.get(name)!;
    const u = await prisma.university.findFirst({
      where: { name },
      select: { id: true, name: true },
    });
    uniCache.set(name, u);
    return u;
  }

  // --- 2. Process each row --------------------------------------------------
  for (const [i, row] of rows.entries()) {
    const lineNo = i + 2; // header + 1-based
    try {
      const sport = clean(row.sport);
      if (!sport || sport.toLowerCase() !== "football") {
        stats.rowsNonFootball++;
        continue;
      }

      const universityName = clean(row.universityName);
      const name = clean(row.name);
      const slug = clean(row.slug);
      // Accept either column name; CSV `role` / `title` both map to DB `title`.
      const title = clean(row.role) ?? clean(row.title);
      const officialProfileUrl =
        clean(row.officialProfileUrl) ?? clean(row.officialPageUrl);
      const sourceUrl = clean(row.sourceUrl);
      const conference = clean(row.conference);
      // `level` and `division` are informational only — never written to Coach.

      if (!universityName || !name) {
        console.log(`  ⏭️  line ${lineNo}: missing universityName or name`);
        stats.skipped++;
        continue;
      }

      // --- University lookup ---
      const university = await findUniversity(universityName);
      if (!university) {
        if (!missingUniversitiesSet.has(universityName)) {
          missingUniversitiesSet.add(universityName);
          missingUniversityRows.push([
            universityName,
            slugify(universityName),
            clean(row.city) ?? "",
            clean(row.state) ?? "",
            "USA",
            "",                 // level — unknown from coach row, leave blank
            conference ?? "",
            "",                 // officialWebsite
            "",                 // athleticsWebsite
            sourceUrl ?? "",
            SEASON_YEAR,
            TODAY_ISO,
          ]);
          stats.universitiesMissing++;
          console.log(`  ⚠️  line ${lineNo}: university not in DB — ${universityName} (queued for missing-universities CSV)`);
        }
        stats.skipped++;
        continue;
      }

      // --- School / football program lookup ---
      const school = await prisma.school.findUnique({
        where: { universityId_sport: { universityId: university.id, sport: "Football" } },
        select: { id: true },
      });
      if (!school) {
        const key = `${universityName}|Football`;
        if (!missingSchoolsSet.has(key)) {
          missingSchoolsSet.add(key);
          missingSchoolRows.push([
            universityName,
            "Football",
            "",                 // division — unknown; admin fills in
            conference ?? "",
            "",                 // description
            "",                 // athleticsUrl
            sourceUrl ?? "",
            hostOf(sourceUrl) ?? "",
            SEASON_YEAR,
            TODAY_ISO,
          ]);
          stats.programsMissing++;
          console.log(`  ⚠️  line ${lineNo}: Football program not in DB at ${universityName} (queued)`);
        }
        stats.skipped++;
        continue;
      }

      // --- Dorm coverage check (orthogonal — doesn't block coach upsert) ---
      if (!missingDormsSet.has(universityName)) {
        const dormCount = await prisma.dorm.count({ where: { universityId: university.id } });
        if (dormCount === 0) {
          missingDormsSet.add(universityName);
          missingDormRows.push([
            "",                       // name — blank, research required
            "",                       // slug — blank
            universityName,
            clean(row.city) ?? "",
            clean(row.state) ?? "",
            "",                       // roomType
            "",                       // bathroomType
            "",                       // yearBuilt
            "",                       // capacity
            "",                       // officialPageUrl
            "",                       // description
            "",                       // imageUrl
            "",                       // sourceUrl
            hostOf(sourceUrl) ?? "",  // sourceName — derived
            SEASON_YEAR,
            TODAY_ISO,
          ]);
          stats.dormCoverageMissing++;
          console.log(`  ℹ️  ${universityName}: no dorms on file (placeholder row queued; coach will still be connected)`);
        }
      }

      // --- 3. Coach upsert ------------------------------------------------
      const data = {
        name,
        slug: slug ?? undefined,
        title,
        gender: clean(row.gender),
        officialProfileUrl,
        sourceUrl,
        sourceName: clean(row.sourceName) ?? hostOf(sourceUrl),
        seasonYear: clean(row.seasonYear) ?? SEASON_YEAR,
        lastVerifiedAt: parseDate(row.lastVerifiedAt) ?? new Date(),
        schoolId: school.id,
      };

      const existing = await prisma.coach.findUnique({
        where: { schoolId_name: { schoolId: school.id, name } },
        select: { id: true, title: true, slug: true, officialProfileUrl: true, sourceUrl: true },
      });

      if (existing) {
        // Detect actual diff so we don't bump updatedAt for no reason.
        const changed =
          existing.title !== data.title ||
          existing.slug !== (data.slug ?? null) ||
          existing.officialProfileUrl !== data.officialProfileUrl ||
          existing.sourceUrl !== data.sourceUrl;
        if (!changed) {
          stats.coachesUnchanged++;
          continue;
        }
        if (APPLY) {
          await prisma.coach.update({ where: { id: existing.id }, data });
        }
        stats.coachesUpdated++;
      } else {
        if (APPLY) {
          await prisma.coach.create({ data });
        }
        stats.coachesCreated++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌  line ${lineNo}: ${message}`);
      stats.errors++;
    }
  }

  // --- 4. Write missing-*.csv reports (always — even on dry-run) -----------
  const reports: string[] = [];
  if (missingUniversityRows.length > 0) {
    const p = path.join(OUT_DIR, "missing-universities-for-coaches.csv");
    writeCsv(p, UNI_HEADER, missingUniversityRows);
    reports.push(p);
  }
  if (missingSchoolRows.length > 0) {
    const p = path.join(OUT_DIR, "missing-schools-for-coaches.csv");
    writeCsv(p, SCHOOL_HEADER, missingSchoolRows);
    reports.push(p);
  }
  if (missingDormRows.length > 0) {
    const p = path.join(OUT_DIR, "missing-dorms-for-coaches.csv");
    writeCsv(p, DORM_HEADER, missingDormRows);
    reports.push(p);
  }

  // --- 5. Always write reference example CSVs for the five Frontier/NSIC --
  //        schools — regardless of current DB state. Stable templates the
  //        user can copy / extend.
  writeCsv(
    path.join(OUT_DIR, "example-frontier-nsic-universities.csv"),
    UNI_HEADER,
    REFERENCE_SCHOOLS.map((s) => [
      s.name, slugify(s.name), s.city, s.state, "USA",
      s.level, s.conference, s.websiteUrl, "", "", SEASON_YEAR, TODAY_ISO,
    ])
  );
  writeCsv(
    path.join(OUT_DIR, "example-frontier-nsic-football-programs.csv"),
    SCHOOL_HEADER,
    REFERENCE_SCHOOLS.map((s) => [
      s.name, "Football", s.level, s.conference, "",
      "", "", "", SEASON_YEAR, TODAY_ISO,
    ])
  );
  writeCsv(
    path.join(OUT_DIR, "example-frontier-nsic-dorms.csv"),
    DORM_HEADER,
    REFERENCE_SCHOOLS.map((s) => [
      "", "", s.name, s.city, s.state, "", "", "", "", "",
      "", "", "", "", SEASON_YEAR, TODAY_ISO,
    ])
  );

  // --- 6. Summary ----------------------------------------------------------
  console.log("\n━━━ Summary ━━━");
  console.log(`Rows loaded:                 ${stats.rowsLoaded}`);
  console.log(`Non-football rows skipped:   ${stats.rowsNonFootball}`);
  console.log(`Coaches ${APPLY ? "created " : "would create"}:        ${stats.coachesCreated}`);
  console.log(`Coaches ${APPLY ? "updated " : "would update"}:        ${stats.coachesUpdated}`);
  console.log(`Coaches unchanged:           ${stats.coachesUnchanged}`);
  console.log(`Universities missing:        ${stats.universitiesMissing}`);
  console.log(`Football programs missing:   ${stats.programsMissing}`);
  console.log(`Dorm coverage missing:       ${stats.dormCoverageMissing}`);
  console.log(`Other skips:                 ${stats.skipped - stats.universitiesMissing - stats.programsMissing}`);
  console.log(`Errors:                      ${stats.errors}`);

  if (reports.length > 0) {
    console.log("\nMissing-data CSV reports written:");
    for (const p of reports) console.log(`  - ${p}`);
  } else {
    console.log("\nNo missing-data reports written (no gaps detected).");
  }
  console.log("\nReference templates (always written):");
  console.log(`  - ${path.join(OUT_DIR, "example-frontier-nsic-universities.csv")}`);
  console.log(`  - ${path.join(OUT_DIR, "example-frontier-nsic-football-programs.csv")}`);
  console.log(`  - ${path.join(OUT_DIR, "example-frontier-nsic-dorms.csv")}`);

  if (!APPLY) {
    console.log("\nDry-run complete. Re-run with --apply to write coach rows.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("CONNECT FAILED");
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
