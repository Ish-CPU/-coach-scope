#!/usr/bin/env tsx
/**
 * CLI wrapper for the RateMyU public-data importer.
 *
 * Usage:
 *   npm run db:import -- universities seed/samples/universities.csv
 *   npm run db:import -- coaches      seed/samples/coaches.csv
 *
 * Or import all sample CSVs at once:
 *   npm run db:import:samples
 *
 * The dependencies between files: universities → programs → coaches → dorms /
 * dining / facilities. The `samples` mode runs them in that order.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { importCsv, IMPORT_TYPES, type ImportType, type ImportResult } from "../src/lib/import-csv";

const prisma = new PrismaClient();

const SAMPLES_DIR = join(process.cwd(), "seed", "samples");

const SAMPLE_ORDER: ImportType[] = [
  "universities",
  "programs",
  "coaches",
  "dorms",
  "dining",
  "facilities",
];

function printResult(r: ImportResult) {
  console.log(
    `→ ${r.type.padEnd(13)} read=${r.rowsRead} created=${r.created} updated=${r.updated} skipped=${r.skipped}`
  );
  for (const e of r.errors) {
    console.log(`   ⚠  row ${e.row}: ${e.message}`);
  }
}

async function importFile(type: ImportType, path: string) {
  if (!existsSync(path)) {
    console.error(`  no file: ${path}`);
    return;
  }
  const csv = readFileSync(path);
  const r = await importCsv(prisma, type, csv);
  printResult(r);
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "samples" || args.length === 0) {
    console.log(`Importing all sample CSVs from ${SAMPLES_DIR}`);
    for (const t of SAMPLE_ORDER) {
      await importFile(t, join(SAMPLES_DIR, `${t}.csv`));
    }
    return;
  }

  if (args.length !== 2) {
    console.error("Usage: npm run db:import -- <type> <path-to-csv>");
    console.error(`       <type> ∈ { ${IMPORT_TYPES.map((t) => t.value).join(" | ")} }`);
    process.exit(1);
  }
  const [type, path] = args;
  if (!IMPORT_TYPES.find((t) => t.value === type)) {
    console.error(`Unknown type: ${type}`);
    process.exit(1);
  }
  await importFile(type as ImportType, path);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
