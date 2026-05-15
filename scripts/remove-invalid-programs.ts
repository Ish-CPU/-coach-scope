/**
 * Remove invalid (university, sport) programs from the database.
 *
 * Reads `data/audits/remove-invalid-programs.csv` (one row per program to drop)
 * with the format:
 *
 *   University Name,Sport
 *   Southern Methodist University,Baseball
 *
 * For each row:
 *   1. Find the University by EXACT name (case-sensitive). If absent → log
 *      "not found" and continue.
 *   2. Find the School (program) row by (universityId, sport). If absent →
 *      log "not found" and continue.
 *   3. Delete every Coach attached to that School first (so foreign-key
 *      constraints don't block the program deletion).
 *   4. Delete the School row itself.
 *
 * The University row is NEVER touched — only the program rows and any coaches
 * attached to them.
 *
 * Idempotent: re-running after a successful pass logs everything as
 * "not found" and exits cleanly.
 *
 * Usage:
 *   npm run cleanup:invalid-programs
 *
 * To preview without writing, set DRY_RUN=1:
 *   DRY_RUN=1 npm run cleanup:invalid-programs
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();

const CSV_PATH = resolve(process.cwd(), "data/audits/remove-invalid-programs.csv");
const DRY_RUN = process.env.DRY_RUN === "1";

interface Row {
  universityName: string;
  sport: string;
  lineNumber: number;
}

interface Stats {
  deleted: number;
  coachesDeleted: number;
  notFoundUniversity: number;
  notFoundProgram: number;
  errors: { university: string; sport: string; message: string }[];
}

function parseCsv(path: string): Row[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  const rows: Row[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;

    // Skip an optional header row of the form "University Name,Sport"
    if (
      i === 0 &&
      /^\s*university\s*name\s*,\s*sport\s*$/i.test(raw)
    ) {
      continue;
    }

    // Quote-aware CSV split for two-column rows. Handles names like
    //   "California State University, Northridge",Baseball
    const cells = splitCsvLine(raw);
    if (cells.length < 2) {
      console.warn(`⚠️   line ${i + 1} skipped (not 2 columns): ${raw}`);
      continue;
    }

    const universityName = cells[0].trim();
    const sport = cells[1].trim();
    if (!universityName || !sport) {
      console.warn(`⚠️   line ${i + 1} skipped (empty name or sport): ${raw}`);
      continue;
    }

    rows.push({ universityName, sport, lineNumber: i + 1 });
  }

  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`❌  CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const rows = parseCsv(CSV_PATH);
  console.log(
    `🧹  Removing ${rows.length} invalid programs from ${CSV_PATH}` +
      (DRY_RUN ? "  (DRY RUN — no writes)" : "") +
      "\n"
  );

  const stats: Stats = {
    deleted: 0,
    coachesDeleted: 0,
    notFoundUniversity: 0,
    notFoundProgram: 0,
    errors: [],
  };

  for (const { universityName, sport, lineNumber } of rows) {
    const tag = `[L${lineNumber}] ${universityName} — ${sport}`;
    try {
      const university = await prisma.university.findFirst({
        where: { name: universityName },
        select: { id: true },
      });

      if (!university) {
        stats.notFoundUniversity++;
        console.log(`❓  not found (university): ${tag}`);
        continue;
      }

      const school = await prisma.school.findUnique({
        where: { universityId_sport: { universityId: university.id, sport } },
        select: { id: true },
      });

      if (!school) {
        stats.notFoundProgram++;
        console.log(`❓  not found (program):    ${tag}`);
        continue;
      }

      const coachCount = await prisma.coach.count({ where: { schoolId: school.id } });

      if (DRY_RUN) {
        console.log(
          `🟡  would delete: ${tag}` +
            (coachCount > 0 ? ` (and ${coachCount} coach${coachCount === 1 ? "" : "es"})` : "")
        );
        continue;
      }

      if (coachCount > 0) {
        const result = await prisma.coach.deleteMany({ where: { schoolId: school.id } });
        stats.coachesDeleted += result.count;
      }

      await prisma.school.delete({ where: { id: school.id } });
      stats.deleted++;
      console.log(
        `✅  deleted: ${tag}` +
          (coachCount > 0 ? ` (and ${coachCount} coach${coachCount === 1 ? "" : "es"})` : "")
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stats.errors.push({ university: universityName, sport, message });
      console.error(`❌  ${tag}: ${message}`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Programs deleted:        ${stats.deleted}`);
  console.log(`Coaches deleted:         ${stats.coachesDeleted}`);
  console.log(`University not found:    ${stats.notFoundUniversity}`);
  console.log(`Program not found:       ${stats.notFoundProgram}`);
  console.log(`Errors:                  ${stats.errors.length}`);
  if (DRY_RUN) console.log("(DRY RUN — no rows were actually deleted)");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
