import Papa from "papaparse";
import { Division, Prisma, PrismaClient } from "@prisma/client";
import { isAllowedSport, resolveSport, SPORTS } from "@/lib/sports";
import { fieldEqual, normalizeName, normalizeSlug } from "@/lib/normalize";

/**
 * University Verified public-data importer.
 *
 * - Parses CSV input (string OR Buffer).
 * - Validates each row against per-type rules: required fields, allowed sports
 *   (see src/lib/sports.ts), supported divisions.
 * - **Idempotent dedupe**: every type matches an existing row by its primary
 *   identifier first (slug where available, else canonical compound key),
 *   then falls back to a normalized-name match scoped to the parent record.
 *   Re-running the same CSV produces zero writes — the rows show up as
 *   "duplicate" instead of being re-created.
 * - Stamps every row with source tracking: sourceUrl, sourceName, seasonYear,
 *   lastVerifiedAt. `lastVerifiedAt` is only set/updated when the CSV row
 *   provides one explicitly, so re-imports don't churn the timestamp.
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
  duplicate: number;
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

/**
 * Parse an explicit CSV date. Returns null if the cell was blank — callers
 * decide whether to default to now() (on insert) or preserve the existing
 * value (on update).
 */
function parseDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
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
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * In-memory lookup over universities keyed by slug AND normalized name.
 * Used by every child importer (programs, coaches, dorms, dining, facilities)
 * so we can match `universityName` cells case-/whitespace-insensitively
 * without hammering the DB once per CSV row.
 */
async function loadUniversityLookup(prisma: PrismaClient) {
  const all = await prisma.university.findMany({
    select: { id: true, name: true, slug: true, city: true, state: true },
  });
  const bySlug = new Map<string, (typeof all)[number]>();
  const byNormalizedName = new Map<string, (typeof all)[number]>();
  for (const u of all) {
    if (u.slug) bySlug.set(u.slug, u);
    byNormalizedName.set(normalizeName(u.name), u);
  }
  return {
    find(rawName: string): (typeof all)[number] | null {
      // Try slug-shaped input first (rare but supported); fall back to name.
      const asSlug = normalizeSlug(rawName);
      if (asSlug && bySlug.has(asSlug)) return bySlug.get(asSlug)!;
      return byNormalizedName.get(normalizeName(rawName)) ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Per-type importers
// ---------------------------------------------------------------------------

// Public-data university CSV columns. Per spec:
//   name,slug,city,state,country,level,conference,officialWebsite,
//   athleticsWebsite,sourceUrl,seasonYear,lastVerifiedAt
//
// `websiteUrl` is kept as a backwards-compat alias for `officialWebsite`.
interface UniversityRow {
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  country?: string;
  level?: string;
  conference?: string;
  officialWebsite?: string;
  athleticsWebsite?: string;
  /** legacy alias for `officialWebsite` */ websiteUrl?: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

// Fields that count for "did this row actually change anything?" comparisons.
// Audit metadata (id, createdAt, updatedAt, lastVerifiedAt) is intentionally
// excluded — we don't want timestamp drift to flip a duplicate into an update.
const UNIVERSITY_COMPARABLE = [
  "slug",
  "name",
  "city",
  "state",
  "country",
  "level",
  "conference",
  "websiteUrl",
  "athleticsWebsite",
  "imageUrl",
  "sourceUrl",
  "sourceName",
  "seasonYear",
  "description",
] as const;

async function importUniversities(prisma: PrismaClient, rows: UniversityRow[]): Promise<ImportResult> {
  const result = blankResult("universities", rows.length);

  // Pre-load every existing university into in-memory dedupe indexes.
  // Universities are bounded (thousands at most) and looking up by slug
  // OR normalized name in JS keeps "University  of Texas" / "university
  // of texas" / "University of Texas" all converging on the same row
  // without raw SQL.
  const allExisting = await prisma.university.findMany();
  const bySlug = new Map<string, (typeof allExisting)[number]>();
  const byNormalizedName = new Map<string, (typeof allExisting)[number]>();
  for (const u of allExisting) {
    if (u.slug) bySlug.set(u.slug, u);
    byNormalizedName.set(normalizeName(u.name), u);
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = blankToNull(r.name);
    if (!name) {
      result.errors.push({ row: i + 2, message: "name is required" });
      result.skipped += 1;
      continue;
    }

    // Validate `level` against the Division enum when provided.
    let level: Division | null | undefined = undefined;
    if (blankToNull(r.level)) {
      level = normalizeDivision(r.level);
      if (!level) {
        result.errors.push({
          row: i + 2,
          message: `Level "${r.level}" not recognized. Use: NCAA Division I/II/III, NAIA, JUCO.`,
        });
        result.skipped += 1;
        continue;
      }
    }

    const slug = normalizeSlug(r.slug);
    // Dedupe lookup — slug first (canonical), then normalized name (fuzzy).
    // Per-spec, "University of Texas" vs "University of Texas at Austin"
    // stay distinct unless their slugs match.
    const existing = (slug ? bySlug.get(slug) : undefined) ?? byNormalizedName.get(normalizeName(name));

    // Prefer `officialWebsite` (new spec) over legacy `websiteUrl`.
    const websiteUrl = blankToNull(r.officialWebsite) ?? blankToNull(r.websiteUrl);
    const candidate: Prisma.UniversityUncheckedCreateInput = {
      name,
      slug,
      city: blankToNull(r.city),
      state: blankToNull(r.state),
      country: blankToNull(r.country) ?? "USA",
      description: blankToNull(r.description),
      websiteUrl,
      athleticsWebsite: blankToNull(r.athleticsWebsite),
      level: level ?? undefined,
      conference: blankToNull(r.conference),
      imageUrl: blankToNull(r.imageUrl),
      sourceUrl: blankToNull(r.sourceUrl),
      sourceName: blankToNull(r.sourceName),
      seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
    };
    const explicitVerifiedAt = parseDate(r.lastVerifiedAt);

    try {
      if (existing) {
        // Compare only the fields the CSV actually controls.
        const sameMaterialContent = UNIVERSITY_COMPARABLE.every((k) =>
          fieldEqual(
            (existing as unknown as Record<string, unknown>)[k],
            (candidate as unknown as Record<string, unknown>)[k]
          )
        );
        // If the row supplied a new lastVerifiedAt, that counts as an update.
        const newerVerifiedAt =
          explicitVerifiedAt && (!existing.lastVerifiedAt || existing.lastVerifiedAt.getTime() !== explicitVerifiedAt.getTime());

        if (sameMaterialContent && !newerVerifiedAt) {
          result.duplicate += 1;
          continue;
        }

        const updated = await prisma.university.update({
          where: { id: existing.id },
          // Only set lastVerifiedAt when explicitly provided — keeps re-imports idempotent.
          data: { ...candidate, ...(explicitVerifiedAt ? { lastVerifiedAt: explicitVerifiedAt } : {}) },
        });
        // Refresh in-memory indexes so subsequent rows see the latest state.
        if (updated.slug) bySlug.set(updated.slug, updated);
        byNormalizedName.set(normalizeName(updated.name), updated);
        result.updated += 1;
      } else {
        const created = await prisma.university.create({
          data: { ...candidate, lastVerifiedAt: explicitVerifiedAt ?? new Date() },
        });
        if (created.slug) bySlug.set(created.slug, created);
        byNormalizedName.set(normalizeName(created.name), created);
        result.created += 1;
      }
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

const PROGRAM_COMPARABLE = [
  "universityId",
  "sport",
  "division",
  "conference",
  "description",
  "athleticsUrl",
  "sourceUrl",
  "sourceName",
  "seasonYear",
] as const;

async function importPrograms(prisma: PrismaClient, rows: ProgramRow[]): Promise<ImportResult> {
  const result = blankResult("programs", rows.length);
  // Cache university + program lookups across rows.
  const uniCache = await loadUniversityLookup(prisma);

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
      const uni = uniCache.find(universityName);
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
      const candidate: Prisma.SchoolUncheckedCreateInput = {
        universityId: uni.id,
        sport,
        division,
        conference: blankToNull(r.conference),
        description: blankToNull(r.description),
        athleticsUrl: blankToNull(r.athleticsUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
      };
      const explicitVerifiedAt = parseDate(r.lastVerifiedAt);

      if (existing) {
        const sameMaterialContent = PROGRAM_COMPARABLE.every((k) =>
          fieldEqual(
            (existing as unknown as Record<string, unknown>)[k],
            (candidate as unknown as Record<string, unknown>)[k]
          )
        );
        const newerVerifiedAt =
          explicitVerifiedAt && (!existing.lastVerifiedAt || existing.lastVerifiedAt.getTime() !== explicitVerifiedAt.getTime());
        if (sameMaterialContent && !newerVerifiedAt) {
          result.duplicate += 1;
          continue;
        }
        await prisma.school.update({
          where: { id: existing.id },
          data: { ...candidate, ...(explicitVerifiedAt ? { lastVerifiedAt: explicitVerifiedAt } : {}) },
        });
        result.updated += 1;
      } else {
        await prisma.school.create({
          data: { ...candidate, lastVerifiedAt: explicitVerifiedAt ?? new Date() },
        });
        result.created += 1;
      }
    } catch (e) {
      result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      result.skipped += 1;
    }
  }
  return result;
}

// Public coaching-staff CSV columns. Per spec:
//   name,slug,universityName,sport,gender,role,level,conference,
//   officialProfileUrl,sourceUrl,seasonYear,lastVerifiedAt
//
// `title` is kept for backwards compat with older CSVs (treated as a `role`
// alias). `level` and `conference` are not stored on Coach — they enrich the
// auto-created/updated School (program) so the same coach + school + level
// data can come in one row.
interface CoachRow {
  name: string;
  slug?: string;
  universityName: string;
  sport: string;
  gender?: string;
  role?: string;
  /** legacy alias for `role` */ title?: string;
  level?: string;
  conference?: string;
  bio?: string;
  imageUrl?: string;
  officialProfileUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

const COACH_COMPARABLE = [
  "name",
  "slug",
  "title",
  "gender",
  "schoolId",
  "bio",
  "imageUrl",
  "sourceUrl",
  "officialProfileUrl",
  "sourceName",
  "seasonYear",
] as const;

async function importCoaches(prisma: PrismaClient, rows: CoachRow[]): Promise<ImportResult> {
  const result = blankResult("coaches", rows.length);
  const uniCache = await loadUniversityLookup(prisma);
  // Per-school coach cache. Loaded lazily so the worst case is one query
  // per program touched by the CSV — cheap and idempotent.
  const coachCacheBySchool = new Map<
    string,
    {
      bySlug: Map<string, Awaited<ReturnType<typeof prisma.coach.findFirst>>>;
      byNormalizedName: Map<string, Awaited<ReturnType<typeof prisma.coach.findFirst>>>;
    }
  >();
  async function getCoachIndex(schoolId: string) {
    const cached = coachCacheBySchool.get(schoolId);
    if (cached) return cached;
    const all = await prisma.coach.findMany({ where: { schoolId } });
    const bySlug = new Map<string, (typeof all)[number]>();
    const byNormalizedName = new Map<string, (typeof all)[number]>();
    for (const c of all) {
      if (c.slug) bySlug.set(c.slug, c);
      byNormalizedName.set(normalizeName(c.name), c);
    }
    const idx = { bySlug, byNormalizedName } as unknown as {
      bySlug: Map<string, Awaited<ReturnType<typeof prisma.coach.findFirst>>>;
      byNormalizedName: Map<string, Awaited<ReturnType<typeof prisma.coach.findFirst>>>;
    };
    coachCacheBySchool.set(schoolId, idx);
    return idx;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = blankToNull(r.name);
    const universityName = blankToNull(r.universityName);
    const rawSport = blankToNull(r.sport);
    const gender = blankToNull(r.gender);
    if (!name || !universityName || !rawSport) {
      result.errors.push({ row: i + 2, message: "name, universityName, and sport are required" });
      result.skipped += 1;
      continue;
    }

    // Accept either a canonical sport ("Men's Basketball") OR a base sport
    // ("Basketball") + gender column. Off-list values are rejected outright.
    const sport = resolveSport(rawSport, gender);
    if (!sport || !isAllowedSport(sport)) {
      result.errors.push({
        row: i + 2,
        message: `Sport "${rawSport}"${gender ? ` (${gender})` : ""} is not supported. Allowed: ${SPORTS.join(", ")}`,
      });
      result.skipped += 1;
      continue;
    }

    const division = normalizeDivision(r.level);
    const conference = blankToNull(r.conference);
    const role = blankToNull(r.role) ?? blankToNull(r.title) ?? "Head Coach";

    try {
      const uni = uniCache.find(universityName);
      if (!uni) {
        result.errors.push({ row: i + 2, message: `University "${universityName}" not found.` });
        result.skipped += 1;
        continue;
      }

      // Upsert the program (school). On create, default to D1 unless the row
      // gave us a level. On update, only overwrite division/conference when
      // the row provided a value — never blank them out.
      const school = await prisma.school.upsert({
        where: { universityId_sport: { universityId: uni.id, sport } },
        create: {
          universityId: uni.id,
          sport,
          division: division ?? Division.D1,
          conference,
          seasonYear: DEFAULT_SEASON,
        },
        update: {
          ...(division ? { division } : {}),
          ...(conference ? { conference } : {}),
        },
      });

      // Dedupe within this school: slug first, then normalized (name + sport
      // are already implicit since we're scoped to (schoolId, sport)).
      const idx = await getCoachIndex(school.id);
      const slug = normalizeSlug(r.slug);
      const existing =
        (slug ? idx.bySlug.get(slug) : undefined) ?? idx.byNormalizedName.get(normalizeName(name)) ?? null;

      const candidate: Prisma.CoachUncheckedCreateInput = {
        name,
        slug,
        title: role,
        gender,
        schoolId: school.id,
        bio: blankToNull(r.bio),
        imageUrl: blankToNull(r.imageUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        officialProfileUrl: blankToNull(r.officialProfileUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
      };
      const explicitVerifiedAt = parseDate(r.lastVerifiedAt);

      if (existing) {
        const sameMaterialContent = COACH_COMPARABLE.every((k) =>
          fieldEqual(
            (existing as unknown as Record<string, unknown>)[k],
            (candidate as unknown as Record<string, unknown>)[k]
          )
        );
        const newerVerifiedAt =
          explicitVerifiedAt && (!existing.lastVerifiedAt || existing.lastVerifiedAt.getTime() !== explicitVerifiedAt.getTime());
        if (sameMaterialContent && !newerVerifiedAt) {
          result.duplicate += 1;
          continue;
        }
        const updated = await prisma.coach.update({
          where: { id: existing.id },
          data: { ...candidate, ...(explicitVerifiedAt ? { lastVerifiedAt: explicitVerifiedAt } : {}) },
        });
        if (updated.slug) idx.bySlug.set(updated.slug, updated);
        idx.byNormalizedName.set(normalizeName(updated.name), updated);
        result.updated += 1;
      } else {
        const created = await prisma.coach.create({
          data: { ...candidate, lastVerifiedAt: explicitVerifiedAt ?? new Date() },
        });
        if (created.slug) idx.bySlug.set(created.slug, created);
        idx.byNormalizedName.set(normalizeName(created.name), created);
        result.created += 1;
      }
    } catch (e) {
      result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      result.skipped += 1;
    }
  }
  return result;
}

// Public-data dorm CSV columns. Per spec:
//   name,slug,universityName,city,state,roomType,bathroomType,
//   yearBuilt,capacity,officialPageUrl,sourceUrl,seasonYear,lastVerifiedAt
interface DormRow {
  name: string;
  slug?: string;
  universityName: string;
  city?: string;
  state?: string;
  roomType?: string;
  bathroomType?: string;
  yearBuilt?: string | number;
  capacity?: string | number;
  officialPageUrl?: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  seasonYear?: string;
  lastVerifiedAt?: string;
}

const ROOM_TYPES = ["Single", "Double", "Suite", "Apartment"] as const;
const BATHROOM_TYPES = ["Private", "Shared", "Communal"] as const;

function normalizeFromVocab(
  raw: string | null | undefined,
  vocab: readonly string[]
): string | null | "INVALID" {
  const v = blankToNull(raw);
  if (!v) return null;
  const found = vocab.find((opt) => opt.toLowerCase() === v.toLowerCase());
  return found ?? "INVALID";
}

function parseInt0(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

const DORM_COMPARABLE = [
  "name",
  "slug",
  "universityId",
  "city",
  "state",
  "description",
  "imageUrl",
  "roomType",
  "bathroomType",
  "yearBuilt",
  "capacity",
  "officialPageUrl",
  "sourceUrl",
  "sourceName",
  "seasonYear",
] as const;

async function importDorms(prisma: PrismaClient, rows: DormRow[]): Promise<ImportResult> {
  const result = blankResult("dorms", rows.length);
  const uniCache = await loadUniversityLookup(prisma);
  // Per-university dorm cache, lazy-loaded.
  const dormCacheByUni = new Map<
    string,
    {
      bySlug: Map<string, Awaited<ReturnType<typeof prisma.dorm.findFirst>>>;
      byNormalizedName: Map<string, Awaited<ReturnType<typeof prisma.dorm.findFirst>>>;
    }
  >();
  async function getDormIndex(universityId: string) {
    const cached = dormCacheByUni.get(universityId);
    if (cached) return cached;
    const all = await prisma.dorm.findMany({ where: { universityId } });
    const bySlug = new Map<string, (typeof all)[number]>();
    const byNormalizedName = new Map<string, (typeof all)[number]>();
    for (const d of all) {
      if (d.slug) bySlug.set(d.slug, d);
      byNormalizedName.set(normalizeName(d.name), d);
    }
    const idx = { bySlug, byNormalizedName } as unknown as {
      bySlug: Map<string, Awaited<ReturnType<typeof prisma.dorm.findFirst>>>;
      byNormalizedName: Map<string, Awaited<ReturnType<typeof prisma.dorm.findFirst>>>;
    };
    dormCacheByUni.set(universityId, idx);
    return idx;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = blankToNull(r.name);
    const universityName = blankToNull(r.universityName);
    if (!name || !universityName) {
      result.errors.push({ row: i + 2, message: "name and universityName are required" });
      result.skipped += 1;
      continue;
    }

    // Controlled-vocab validation. Empty = no value (allowed).
    const roomType = normalizeFromVocab(r.roomType, ROOM_TYPES);
    if (roomType === "INVALID") {
      result.errors.push({
        row: i + 2,
        message: `roomType "${r.roomType}" not allowed. Use one of: ${ROOM_TYPES.join(", ")} (or leave blank).`,
      });
      result.skipped += 1;
      continue;
    }
    const bathroomType = normalizeFromVocab(r.bathroomType, BATHROOM_TYPES);
    if (bathroomType === "INVALID") {
      result.errors.push({
        row: i + 2,
        message: `bathroomType "${r.bathroomType}" not allowed. Use one of: ${BATHROOM_TYPES.join(", ")} (or leave blank).`,
      });
      result.skipped += 1;
      continue;
    }

    try {
      const uni = uniCache.find(universityName);
      if (!uni) {
        result.errors.push({ row: i + 2, message: `University "${universityName}" not found.` });
        result.skipped += 1;
        continue;
      }

      const slug = normalizeSlug(r.slug);
      const idx = await getDormIndex(uni.id);
      const existing =
        (slug ? idx.bySlug.get(slug) : undefined) ?? idx.byNormalizedName.get(normalizeName(name)) ?? null;

      const candidate: Prisma.DormUncheckedCreateInput = {
        universityId: uni.id,
        name,
        slug,
        // Inherit city/state from the host university when the row didn't set them.
        city: blankToNull(r.city) ?? uni.city,
        state: blankToNull(r.state) ?? uni.state,
        description: blankToNull(r.description),
        imageUrl: blankToNull(r.imageUrl),
        roomType: (roomType as string | null) ?? null,
        bathroomType: (bathroomType as string | null) ?? null,
        yearBuilt: parseInt0(r.yearBuilt),
        capacity: parseInt0(r.capacity),
        officialPageUrl: blankToNull(r.officialPageUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
      };
      const explicitVerifiedAt = parseDate(r.lastVerifiedAt);

      if (existing) {
        const sameMaterialContent = DORM_COMPARABLE.every((k) =>
          fieldEqual(
            (existing as unknown as Record<string, unknown>)[k],
            (candidate as unknown as Record<string, unknown>)[k]
          )
        );
        const newerVerifiedAt =
          explicitVerifiedAt && (!existing.lastVerifiedAt || existing.lastVerifiedAt.getTime() !== explicitVerifiedAt.getTime());
        if (sameMaterialContent && !newerVerifiedAt) {
          result.duplicate += 1;
          continue;
        }
        const updated = await prisma.dorm.update({
          where: { id: existing.id },
          data: { ...candidate, ...(explicitVerifiedAt ? { lastVerifiedAt: explicitVerifiedAt } : {}) },
        });
        if (updated.slug) idx.bySlug.set(updated.slug, updated);
        idx.byNormalizedName.set(normalizeName(updated.name), updated);
        result.updated += 1;
      } else {
        const created = await prisma.dorm.create({
          data: { ...candidate, lastVerifiedAt: explicitVerifiedAt ?? new Date() },
        });
        if (created.slug) idx.bySlug.set(created.slug, created);
        idx.byNormalizedName.set(normalizeName(created.name), created);
        result.created += 1;
      }
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

const DINING_COMPARABLE = [
  "name",
  "universityId",
  "location",
  "hours",
  "description",
  "imageUrl",
  "sourceUrl",
  "sourceName",
  "seasonYear",
] as const;

async function importDining(prisma: PrismaClient, rows: DiningRow[]): Promise<ImportResult> {
  const result = blankResult("dining", rows.length);
  const uniCache = await loadUniversityLookup(prisma);
  // Per-university dining cache, lazy-loaded.
  const cacheByUni = new Map<string, Map<string, Awaited<ReturnType<typeof prisma.dining.findFirst>>>>();
  async function getDiningIndex(universityId: string) {
    const cached = cacheByUni.get(universityId);
    if (cached) return cached;
    const all = await prisma.dining.findMany({ where: { universityId } });
    const byNormalizedName = new Map<string, (typeof all)[number]>();
    for (const d of all) byNormalizedName.set(normalizeName(d.name), d);
    const idx = byNormalizedName as unknown as Map<string, Awaited<ReturnType<typeof prisma.dining.findFirst>>>;
    cacheByUni.set(universityId, idx);
    return idx;
  }

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
      const uni = uniCache.find(universityName);
      if (!uni) {
        result.errors.push({ row: i + 2, message: `University "${universityName}" not found.` });
        result.skipped += 1;
        continue;
      }
      const idx = await getDiningIndex(uni.id);
      const existing = idx.get(normalizeName(name)) ?? null;

      const candidate: Prisma.DiningUncheckedCreateInput = {
        universityId: uni.id,
        name,
        location: blankToNull(r.location),
        hours: blankToNull(r.hours),
        description: blankToNull(r.description),
        imageUrl: blankToNull(r.imageUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
      };
      const explicitVerifiedAt = parseDate(r.lastVerifiedAt);

      if (existing) {
        const sameMaterialContent = DINING_COMPARABLE.every((k) =>
          fieldEqual(
            (existing as unknown as Record<string, unknown>)[k],
            (candidate as unknown as Record<string, unknown>)[k]
          )
        );
        const newerVerifiedAt =
          explicitVerifiedAt && (!existing.lastVerifiedAt || existing.lastVerifiedAt.getTime() !== explicitVerifiedAt.getTime());
        if (sameMaterialContent && !newerVerifiedAt) {
          result.duplicate += 1;
          continue;
        }
        const updated = await prisma.dining.update({
          where: { id: existing.id },
          data: { ...candidate, ...(explicitVerifiedAt ? { lastVerifiedAt: explicitVerifiedAt } : {}) },
        });
        idx.set(normalizeName(updated.name), updated);
        result.updated += 1;
      } else {
        const created = await prisma.dining.create({
          data: { ...candidate, lastVerifiedAt: explicitVerifiedAt ?? new Date() },
        });
        idx.set(normalizeName(created.name), created);
        result.created += 1;
      }
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

const FACILITY_COMPARABLE = [
  "name",
  "universityId",
  "sport",
  "facilityType",
  "description",
  "imageUrl",
  "sourceUrl",
  "sourceName",
  "seasonYear",
] as const;

async function importFacilities(prisma: PrismaClient, rows: FacilityRow[]): Promise<ImportResult> {
  const result = blankResult("facilities", rows.length);
  const uniCache = await loadUniversityLookup(prisma);
  const cacheByUni = new Map<string, Map<string, Awaited<ReturnType<typeof prisma.facility.findFirst>>>>();
  async function getFacilityIndex(universityId: string) {
    const cached = cacheByUni.get(universityId);
    if (cached) return cached;
    const all = await prisma.facility.findMany({ where: { universityId } });
    const byNormalizedName = new Map<string, (typeof all)[number]>();
    for (const f of all) byNormalizedName.set(normalizeName(f.name), f);
    const idx = byNormalizedName as unknown as Map<string, Awaited<ReturnType<typeof prisma.facility.findFirst>>>;
    cacheByUni.set(universityId, idx);
    return idx;
  }

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
      const uni = uniCache.find(universityName);
      if (!uni) {
        result.errors.push({ row: i + 2, message: `University "${universityName}" not found.` });
        result.skipped += 1;
        continue;
      }
      const idx = await getFacilityIndex(uni.id);
      const existing = idx.get(normalizeName(name)) ?? null;

      const candidate: Prisma.FacilityUncheckedCreateInput = {
        universityId: uni.id,
        name,
        sport: sport ?? null,
        facilityType: blankToNull(r.facilityType),
        description: blankToNull(r.description),
        imageUrl: blankToNull(r.imageUrl),
        sourceUrl: blankToNull(r.sourceUrl),
        sourceName: blankToNull(r.sourceName),
        seasonYear: blankToNull(r.seasonYear) ?? DEFAULT_SEASON,
      };
      const explicitVerifiedAt = parseDate(r.lastVerifiedAt);

      if (existing) {
        const sameMaterialContent = FACILITY_COMPARABLE.every((k) =>
          fieldEqual(
            (existing as unknown as Record<string, unknown>)[k],
            (candidate as unknown as Record<string, unknown>)[k]
          )
        );
        const newerVerifiedAt =
          explicitVerifiedAt && (!existing.lastVerifiedAt || existing.lastVerifiedAt.getTime() !== explicitVerifiedAt.getTime());
        if (sameMaterialContent && !newerVerifiedAt) {
          result.duplicate += 1;
          continue;
        }
        const updated = await prisma.facility.update({
          where: { id: existing.id },
          data: { ...candidate, ...(explicitVerifiedAt ? { lastVerifiedAt: explicitVerifiedAt } : {}) },
        });
        idx.set(normalizeName(updated.name), updated);
        result.updated += 1;
      } else {
        const created = await prisma.facility.create({
          data: { ...candidate, lastVerifiedAt: explicitVerifiedAt ?? new Date() },
        });
        idx.set(normalizeName(created.name), created);
        result.created += 1;
      }
    } catch (e) {
      result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      result.skipped += 1;
    }
  }
  return result;
}

function blankResult(type: ImportType, rowsRead: number): ImportResult {
  return { type, rowsRead, created: 0, updated: 0, duplicate: 0, skipped: 0, errors: [] };
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
