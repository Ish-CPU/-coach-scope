/**
 * Export all PENDING program requests to data/exports/program-requests.csv.
 *
 * Treat this as a data pipeline:
 *   1. Athletes submit via /request-school
 *   2. This script dumps the queue into a CSV
 *   3. Admin uses the CSV as input for the universities/programs importers
 *   4. Once imported, the request can be marked APPROVED in /admin/requests
 *
 * Usage:
 *   npm run requests:export
 *
 * Override the status filter with --status=ALL to export every row.
 */
import { PrismaClient, type RequestStatus } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const CSV_FIELDS = [
  "schoolName",
  "sport",
  "division",
  "conference",
  "state",
  "athleticsUrl",
  "rosterUrl",
  "requesterEmail",
  "notes",
  "status",
  "createdAt",
] as const;

function parseStatus(arg: string | undefined): RequestStatus | "ALL" {
  if (!arg) return "PENDING";
  const upper = arg.toUpperCase();
  if (upper === "ALL") return "ALL";
  if (
    upper === "PENDING" ||
    upper === "APPROVED" ||
    upper === "REJECTED" ||
    upper === "NEEDS_REVIEW"
  ) {
    return upper;
  }
  console.error(
    `Unknown --status=${arg}. Use one of: PENDING, APPROVED, REJECTED, NEEDS_REVIEW, ALL.`
  );
  process.exit(1);
}

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // RFC 4180-ish: quote when the value contains a delimiter, newline, or quote.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--status="));
  const wanted = parseStatus(arg?.split("=")[1]);
  const where = wanted === "ALL" ? {} : { status: wanted };

  const rows = await prisma.programRequest.findMany({
    where,
    orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
  });

  const outDir = path.resolve(process.cwd(), "data", "exports");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "program-requests.csv");

  const header = CSV_FIELDS.join(",");
  const body = rows
    .map((r) =>
      CSV_FIELDS.map((f) => escapeCell((r as Record<string, unknown>)[f])).join(",")
    )
    .join("\n");

  fs.writeFileSync(outPath, header + "\n" + body + (body ? "\n" : ""), "utf8");

  console.log(
    `Exported ${rows.length} request${rows.length === 1 ? "" : "s"} (status=${wanted}) → ${path.relative(process.cwd(), outPath)}`
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
