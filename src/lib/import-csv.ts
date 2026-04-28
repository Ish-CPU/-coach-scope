import Papa from "papaparse";
import { Division, Prisma, PrismaClient } from "@prisma/client";
import { isAllowedSport, SPORTS } from "@/lib/sports";

/**
 * RateMyU public-data importer.
 *
 * - Parses CSV input (string OR Buffer).
 * - Validates each row against per-type rules: required fields, allowed sports
 *   (see src/lib/sports.ts), supported divisions.
 * - Upserts via Prisma keyed on natural unique constraints.
 * - Stamps every row with source tracking: sourceUrl, sourceName, seasonYear,
 *   lastVerifiedAt (now()).
 *
 * Reviews and ratings are NEVER imported here — that data must come from
 * verified users.
 */

export type ImportType =
  | "universities"
  | "programs"
  | "coaches"
  | "dorms"
  | "dining"
  | "facilities";

export interface ImportResult {
  type: ImportType;
  rowsRead: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const DEFAULT_SEASON = "2025-2026";

function parseCsv<T>(input: string | Buffer): T[] {
  const text = typeof input === "string" ? input : input.toString("utf-8");
  const parsed = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error on row ${first.row ?? "?"}: ${first.message}`);
  }
  return parsed.data;
}

function nowOrNull(v: string | undefined | null): Date | null {
  if (!v) return new Date();
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : new Date();
}

function blankToNull(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

const DIVISION_ALIASES: Record<string, Division> = {
  "ncaa division i": Division.D1,
  "ncaa d1": Division.D1,
  "d1": Division.D1,
  "i": Division.D1,
  "ncaa division ii": Division.D2,
  "ncaa d2": Division.D2,
  "d2": Division.D2,
  "ii": Division.D2,
  "ncaa division iii": Division.D3,
  "ncaa d3": Division.D3,
  "d3": Division.D3,
  "iii": Division.D3,
  "naia": Division.NAIA,
  "njcaa": Division.NJCAA,
  "juco": Division.NJCAA,
  "community college": Division.NJCAA,
  "junior college": Division.NJCAA,
  "other": Division.OTHER,
};

export function normalizeDivision(raw: string | undefined | null): Division | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return DIVISION_ALIASES[key] ?? null;
}

// ---------------------------------------------------------------------------
// Per-type importers
// ---------------------------------------------------------------------------

interface UniversityRow {
  name: string;
  city?: string;
  state?: string;
  description?: string;
  websiteUrl?: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

async function importUniversities(prisma: PrismaClient, rows: UniversityRow[]): Promise<ImportResult> {
  const result = blankResult("universities", rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = blankToNull(r.name);
    if (!name) {
      result.errors.push({ row: i + 2, message: "name is required" });
      result.skipped += 1;
      continue;
    }
    try {
      const existing = await prisma.university.findUnique({ where: { name } });
      const data: Prisma.UniversityUpsertArgs["create"] = {
        name,
        city: blankToNull(r.city),
        state: blankToNull(r.state),
        description: blankToNull(r.description),
        websiteUrl: blankToNull(r.websiteUrl),
        imageUrl: blankToNull(r.imageUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
        lastVerifiedAt: nowOrNull(r.lastVerifiedAt),
      };
      await prisma.university.upsert({
        where: { name },
        create: data,
        update: data,
      });
      if (existing) result.updated += 1;
      else result.created += 1;
    } catch (e) {
      result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      result.skipped += 1;
    }
  }
  return result;
}

interface ProgramRow {
  universityName: string;
  sport: string;
  division?: string;
  conference?: string;
  description?: string;
  athleticsUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

async function importPrograms(prisma: PrismaClient, rows: ProgramRow[]): Promise<ImportResult> {
  const result = blankResult("programs", rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const universityName = blankToNull(r.universityName);
    const sport = blankToNull(r.sport);
    if (!universityName || !sport) {
      result.errors.push({ row: i + 2, message: "universityName and sport are required" });
      result.skipped += 1;
      continue;
    }
    if (!isAllowedSport(sport)) {
      result.errors.push({
        row: i + 2,
        message: `Sport "${sport}" is not supported. Allowed: ${SPORTS.join(", ")}`,
      });
      result.skipped += 1;
      continue;
    }
    const division = normalizeDivision(r.division) ?? Division.D1;
    try {
      const uni = await prisma.university.findUnique({ where: { name: universityName } });
      if (!uni) {
        result.errors.push({
          row: i + 2,
          message: `University "${universityName}" not found — import universities first.`,
        });
        result.skipped += 1;
        continue;
      }
      const existing = await prisma.school.findUnique({
        where: { universityId_sport: { universityId: uni.id, sport } },
      });
      const data: Prisma.SchoolUncheckedCreateInput = {
        universityId: uni.id,
        sport,
        division,
        conference: blankToNull(r.conference),
        description: blankToNull(r.description),
        athleticsUrl: blankToNull(r.athleticsUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
        lastVerifiedAt: nowOrNull(r.lastVerifiedAt),
      };
      await prisma.school.upsert({
        where: { universityId_sport: { universityId: uni.id, sport } },
        create: data,
        update: data,
      });
      if (existing) result.updated += 1;
      else result.created += 1;
    } catch (e) {
      result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      result.skipped += 1;
    }
  }
  return result;
}

interface CoachRow {
  name: string;
  title?: string;
  universityName: string;
  sport: string;
  bio?: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

async function importCoaches(prisma: PrismaClient, rows: CoachRow[]): Promise<ImportResult> {
  const result = blankResult("coaches", rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = blankToNull(r.name);
    const universityName = blankToNull(r.universityName);
    const sport = blankToNull(r.sport);
    if (!name || !universityName || !sport) {
      result.errors.push({ row: i + 2, message: "name, universityName, and sport are required" });
      result.skipped += 1;
      continue;
    }
    if (!isAllowedSport(sport)) {
      result.errors.push({
        row: i + 2,
        message: `Sport "${sport}" is not supported. Allowed: ${SPORTS.join(", ")}`,
      });
      result.skipped += 1;
      continue;
    }
    try {
      const uni = await prisma.university.findUnique({ where: { name: universityName } });
      if (!uni) {
        result.errors.push({ row: i + 2, message: `University "${universityName}" not found.` });
        result.skipped += 1;
        continue;
      }
      // Auto-create the program (school) if missing — admins can enrich it via programs.csv later.
      const school = await prisma.school.upsert({
        where: { universityId_sport: { universityId: uni.id, sport } },
        create: { universityId: uni.id, sport, division: Division.D1, seasonYear: DEFAULT_SEASON },
        update: {},
      });
      const existing = await prisma.coach.findUnique({
        where: { schoolId_name: { schoolId: school.id, name } },
      });
      const data: Prisma.CoachUncheckedCreateInput = {
        name,
        title: blankToNull(r.title) ?? "Head Coach",
        schoolId: school.id,
        bio: blankToNull(r.bio),
        imageUrl: blankToNull(r.imageUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
        lastVerifiedAt: nowOrNull(r.lastVerifiedAt),
      };
      await prisma.coach.upsert({
        where: { schoolId_name: { schoolId: school.id, name } },
        create: data,
        update: data,
      });
      if (existing) result.updated += 1;
      else result.created += 1;
    } catch (e) {
      result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      result.skipped += 1;
    }
  }
  return result;
}

interface DormRow {
  name: string;
  universityName: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

async function importDorms(prisma: PrismaClient, rows: DormRow[]): Promise<ImportResult> {
  const result = blankResult("dorms", rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = blankToNull(r.name);
    const universityName = blankToNull(r.universityName);
    if (!name || !universityName) {
      result.errors.push({ row: i + 2, message: "name and universityName are required" });
      result.skipped += 1;
      continue;
    }
    try {
      const uni = await prisma.university.findUnique({ where: { name: universityName } });
      if (!uni) {
        result.errors.push({ row: i + 2, message: `University "${universityName}" not found.` });
        result.skipped += 1;
        continue;
      }
      const existing = await prisma.dorm.findUnique({
        where: { universityId_name: { universityId: uni.id, name } },
      });
      const data: Prisma.DormUncheckedCreateInput = {
        universityId: uni.id,
        name,
        description: blankToNull(r.description),
        imageUrl: blankToNull(r.imageUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
        lastVerifiedAt: nowOrNull(r.lastVerifiedAt),
      };
      await prisma.dorm.upsert({
        where: { universityId_name: { universityId: uni.id, name } },
        create: data,
        update: data,
      });
      if (existing) result.updated += 1;
      else result.created += 1;
    } catch (e) {
      result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      result.skipped += 1;
    }
  }
  return result;
}

interface DiningRow {
  name: string;
  universityName: string;
  location?: string;
  hours?: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

async function importDining(prisma: PrismaClient, rows: DiningRow[]): Promise<ImportResult> {
  const result = blankResult("dining", rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = blankToNull(r.name);
    const universityName = blankToNull(r.universityName);
    if (!name || !universityName) {
      result.errors.push({ row: i + 2, message: "name and universityName are required" });
      result.skipped += 1;
      continue;
    }
    try {
      const uni = await prisma.university.findUnique({ where: { name: universityName } });
      if (!uni) {
        result.errors.push({ row: i + 2, message: `University "${universityName}" not found.` });
        result.skipped += 1;
        continue;
      }
      const existing = await prisma.dining.findUnique({
        where: { universityId_name: { universityId: uni.id, name } },
      });
      const data: Prisma.DiningUncheckedCreateInput = {
        universityId: uni.id,
        name,
        location: blankToNull(r.location),
        hours: blankToNull(r.hours),
        description: blankToNull(r.description),
        imageUrl: blankToNull(r.imageUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
        lastVerifiedAt: nowOrNull(r.lastVerifiedAt),
      };
      await prisma.dining.upsert({
        where: { universityId_name: { universityId: uni.id, name } },
        create: data,
        update: data,
      });
      if (existing) result.updated += 1;
      else result.created += 1;
    } catch (e) {
      result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      result.skipped += 1;
    }
  }
  return result;
}

interface FacilityRow {
  name: string;
  universityName: string;
  sport?: string;
  facilityType?: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

async function importFacilities(prisma: PrismaClient, rows: FacilityRow[]): Promise<ImportResult> {
  const result = blankResult("facilities", rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = blankToNull(r.name);
    const universityName = blankToNull(r.universityName);
    if (!name || !universityName) {
      result.errors.push({ row: i + 2, message: "name and universityName are required" });
      result.skipped += 1;
      continue;
    }
    const sport = blankToNull(r.sport);
    if (sport && !isAllowedSport(sport)) {
      result.errors.push({
        row: i + 2,
        message: `Sport "${sport}" is not supported. Allowed: ${SPORTS.join(", ")} (or leave blank)`,
      });
      result.skipped += 1;
      continue;
    }
    try {
      const uni = await prisma.university.findUnique({ where: { name: universityName } });
      if (!uni) {
        result.errors.push({ row: i + 2, message: `University "${universityName}" not found.` });
        result.skipped += 1;
        continue;
      }
      const existing = await prisma.facility.findUnique({
        where: { universityId_name: { universityId: uni.id, name } },
      });
      const data: Prisma.FacilityUncheckedCreateInput = {
        universityId: uni.id,
        name,
        sport: sport ?? null,
        facilityType: blankToNull(r.facilityType),
        description: blankToNull(r.description),
        imageUrl: blankToNull(r.imageUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
        lastVerifiedAt: nowOrNull(r.lastVerifiedAt),
      };
      await prisma.facility.upsert({
        where: { universityId_name: { universityId: uni.id, name } },
        create: data,
        update: data,
      });
      if (existing) result.updated += 1;
      else result.created += 1;
    } catch (e) {
      result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      result.skipped += 1;
    }
  }
  return result;
}

function blankResult(type: ImportType, rowsRead: number): ImportResult {
  return { type, rowsRead, created: 0, updated: 0, skipped: 0, errors: [] };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function importCsv(
  prisma: PrismaClient,
  type: ImportType,
  csv: string | Buffer
): Promise<ImportResult> {
  switch (type) {
    case "universities":
      return importUniversities(prisma, parseCsv<UniversityRow>(csv));
    case "programs":
      return importPrograms(prisma, parseCsv<ProgramRow>(csv));
    case "coaches":
      return importCoaches(prisma, parseCsv<CoachRow>(csv));
    case "dorms":
      return importDorms(prisma, parseCsv<DormRow>(csv));
    case "dining":
      return importDining(prisma, parseCsv<DiningRow>(csv));
    case "facilities":
      return importFacilities(prisma, parseCsv<FacilityRow>(csv));
  }
}

export const IMPORT_TYPES: { value: ImportType; label: string; description: string }[] = [
  {
    value: "universities",
    label: "Universities",
    description: "Names, locations, official websites. Import this first.",
  },
  {
    value: "programs",
    label: "Athletic programs",
    description: "Sport + division + conference per university. Sports must be supported.",
  },
  {
    value: "coaches",
    label: "Coaches",
    description: "Names, titles, sport. Auto-creates the program if missing.",
  },
  {
    value: "dorms",
    label: "Residence halls",
    description: "Dorm / housing directory entries.",
  },
  {
    value: "dining",
    label: "Campus dining",
    description: "Dining halls, cafés, retail dining locations.",
  },
  {
    value: "facilities",
    label: "Athletic facilities",
    description: "Stadiums, weight rooms, practice facilities, training rooms.",
  },
];
