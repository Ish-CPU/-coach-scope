import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import { Division, Prisma, ReviewType } from "@prisma/client";
import {
  buildNameLikeClauses,
  expandSchoolAliases,
  scoreSearchHit,
} from "@/lib/search-normalize";

export type SearchKind = "all" | "coach" | "university" | "dorm" | "school";

export interface SearchFilters {
  q?: string;
  kind?: SearchKind;
  sport?: string;
  division?: Division;
  /** 2-letter US state code, matched case-insensitively (e.g. "AL", "ca"). */
  state?: string;
  /** Conference name substring, matched case-insensitively (e.g. "SEC", "ACC", "Big Ten"). */
  conference?: string;
  universityId?: string;
  minRating?: number;
  reviewType?: ReviewType;
  verifiedAthleteOnly?: boolean;
  parentReviewsOnly?: boolean;
  verifiedStudentOnly?: boolean;
  /**
   * Lifecycle filters. Orthogonal to the role flags above — combine to get
   * e.g. "verified athletes who are NOT alumni" by setting
   * `verifiedAthleteOnly && currentOnly`. Reads `author.isAlumni` first and
   * falls back to the legacy *_ALUMNI roles so older review rows still
   * filter correctly.
   */
  currentOnly?: boolean;
  alumniOnly?: boolean;
  /**
   * Narrow to reviews authored by users whose former-school (or former-
   * program) matches. Cheap because we index `User.formerUniversityId`.
   * Combines with `currentOnly`/`alumniOnly` for "Former players of Coach X
   * who are now alumni".
   */
  formerUniversityId?: string;
  formerProgramId?: string;
  limit?: number;
}

export interface SearchHit {
  type: "coach" | "university" | "dorm" | "school";
  id: string;
  title: string;
  subtitle?: string;
  rating?: number;
  reviewCount?: number;
  href: string;
  /**
   * Type-specific metadata. Lets ResultCard render a richer coach/program
   * card without forcing every hit type to carry the same shape.
   */
  meta?: {
    sport?: string | null;
    division?: Division | null;
    conference?: string | null;
    schoolName?: string | null;   // university.name
    coachTitle?: string | null;   // coach.title (e.g. "Head Coach")
    state?: string | null;        // 2-letter state code
  };
}

/**
 * Internal augmentation of SearchHit used for ranking only. The
 * `universityName` lets the scorer reward alias matches against the
 * backing university even when the title is something else (e.g. a coach
 * name or "Florida Football").
 */
type ScoredSearchHit = SearchHit & { __universityName?: string };

// Default 100 results per page (was 20). Hard cap of 500 is the largest a
// single search query may request — keeps payload sizes and Postgres LIMIT
// reasonable while still supporting "Load More" up to a meaningful ceiling.
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function runSearch(f: SearchFilters): Promise<SearchHit[]> {
  const limit = Math.min(Math.max(1, f.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const perTypeLimit = f.kind === "all" || !f.kind ? MAX_LIMIT : limit;

  const q = f.q?.trim();

  const ratingFilter = f.minRating
    ? { reviews: { some: { overall: { gte: f.minRating } } } }
    : undefined;

  // Pre-compute alias-expanded lookups once and share them with every
  // per-type query. Empty arrays mean "no extra OR clauses" — same behavior
  // as before for non-aliased queries.
  const aliasNames = q ? expandSchoolAliases(q) : [];
  const nameLikes = q ? buildNameLikeClauses(q) : [];

  const promises: Promise<ScoredSearchHit[]>[] = [];

  if (!f.kind || f.kind === "all" || f.kind === "coach") {
    promises.push(searchCoaches(q, f, perTypeLimit, ratingFilter, aliasNames, nameLikes));
  }
  if (!f.kind || f.kind === "all" || f.kind === "university") {
    promises.push(searchUniversities(q, f, perTypeLimit, ratingFilter, aliasNames, nameLikes));
  }
  if (!f.kind || f.kind === "all" || f.kind === "dorm") {
    promises.push(searchDorms(q, f, perTypeLimit, ratingFilter, aliasNames, nameLikes));
  }
  if (!f.kind || f.kind === "all" || f.kind === "school") {
    promises.push(searchSchools(q, f, perTypeLimit, ratingFilter, aliasNames, nameLikes));
  }

  const raw = await safe(
    async () => (await Promise.all(promises)).flat(),
    [] as ScoredSearchHit[],
    "search:run"
  );

  // De-dupe by (type, id) — alias expansion can re-fetch the same row via
  // different OR branches at the Prisma layer.
  const seen = new Set<string>();
  const results: ScoredSearchHit[] = [];
  for (const r of raw) {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(r);
  }

  // Rank by relevance when there's a query — otherwise preserve insertion
  // order so existing list views (no `q`) stay stable.
  if (q) {
    results.sort((a, b) => {
      const sa = scoreSearchHit(q, { ...a, universityName: a.__universityName });
      const sb = scoreSearchHit(q, { ...b, universityName: b.__universityName });
      return sb - sa;
    });
  }

  // Apply the caller's overall limit and strip the internal helper field
  // so the public response shape stays exactly `SearchHit[]`.
  return results.slice(0, limit).map(({ __universityName, ...rest }) => rest);
}

  

async function searchCoaches(
  q: string | undefined,
  f: SearchFilters,
  limit: number,
  ratingFilter: Prisma.CoachWhereInput | undefined,
  aliasNames: string[],
  nameLikes: { contains: string; mode: "insensitive" }[]
): Promise<ScoredSearchHit[]> {
  // Coach matching widens to: literal coach name match (existing behavior)
  // OR the coach's school being at a university whose name matches the
  // user query / any alias expansion. This is what lets "bama" surface
  // Alabama's coaches even though "Nick Saban" doesn't contain "bama".
  const universityNameClauses = nameLikes.length
    ? nameLikes.map((c) => ({ name: c }))
    : [];
  if (aliasNames.length) {
    for (const n of aliasNames) universityNameClauses.push({ name: { equals: n, mode: "insensitive" } as any });
  }

  const where: Prisma.CoachWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              ...(universityNameClauses.length
                ? [{ school: { university: { OR: universityNameClauses } } }]
                : []),
            ],
          }
        : {},
      f.sport ? { school: { sport: { equals: f.sport, mode: "insensitive" } } } : {},
      f.division ? { school: { division: f.division } } : {},
      f.conference
        ? {
            OR: [
              { school: { conference: { contains: f.conference, mode: "insensitive" } } },
              { school: { university: { conference: { contains: f.conference, mode: "insensitive" } } } },
            ],
          }
        : {},
      f.state ? { school: { university: { state: { equals: f.state, mode: "insensitive" } } } } : {},
      f.universityId ? { school: { universityId: f.universityId } } : {},
      ratingFilter ?? {},
    ],
  };

  const rows = await safe(
    () =>
      prisma.coach.findMany({
        where,
        take: limit,
        include: {
          school: { include: { university: true } },
          reviews: {
            select: { overall: true, weight: true, reviewType: true, author: { select: { role: true, isAlumni: true, formerUniversityId: true, formerProgramId: true } } },
          },
        },
      }),
    [],
    "search:coaches"
  );

  return rows.map((c) => {
    const filtered = filterReviews(c.reviews, f);
    return {
      type: "coach" as const,
      id: c.id,
      title: c.name,
      subtitle: `${c.title ?? "Coach"} · ${c.school.sport} · ${c.school.university.name}`,
      rating: weightedAvg(filtered),
      reviewCount: filtered.length,
      href: `/coach/${c.id}`,
      meta: {
        sport: c.school.sport,
        division: c.school.division,
        conference: c.school.conference ?? c.school.university.conference ?? null,
        schoolName: c.school.university.name,
        coachTitle: c.title ?? "Coach",
        state: c.school.university.state ?? null,
      },
      __universityName: c.school.university.name,
    };
  });
}

async function searchUniversities(
  q: string | undefined,
  f: SearchFilters,
  limit: number,
  ratingFilter: Prisma.UniversityWhereInput | undefined,
  aliasNames: string[],
  nameLikes: { contains: string; mode: "insensitive" }[]
): Promise<ScoredSearchHit[]> {
  // Universities don't have a single "division" — they field many programs
  // across divisions. "Show D1 universities" → universities with at least one
  // program at that division. Sport filter scopes the same relation.
  const programMatch: Prisma.SchoolWhereInput | undefined =
    f.division || f.sport
      ? {
          ...(f.division ? { division: f.division } : {}),
          ...(f.sport ? { sport: { equals: f.sport, mode: "insensitive" } } : {}),
        }
      : undefined;

  // OR-list for the name field, with alias-expanded variants added so
  // "bama" pulls in "University of Alabama". `nameLikes` already includes
  // the original query as a `contains` clause.
  const nameOrClauses: Prisma.UniversityWhereInput[] = nameLikes.map((c) => ({ name: c }));
  for (const n of aliasNames) nameOrClauses.push({ name: { equals: n, mode: "insensitive" } });

  const where: Prisma.UniversityWhereInput = {
    AND: [
      q
        ? {
            OR: [
              ...nameOrClauses,
              { city: { contains: q, mode: "insensitive" } },
              { state: { contains: q, mode: "insensitive" } },
              { conference: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      programMatch ? { schools: { some: programMatch } } : {},
      f.state ? { state: { equals: f.state, mode: "insensitive" } } : {},
      f.conference
        ? {
            OR: [
              { conference: { contains: f.conference, mode: "insensitive" } },
              { schools: { some: { conference: { contains: f.conference, mode: "insensitive" } } } },
            ],
          }
        : {},
      ratingFilter ?? {},
    ],
  };
  const rows = await safe(
    () =>
      prisma.university.findMany({
        where,
        take: limit,
        include: {
          reviews: {
            select: { overall: true, weight: true, reviewType: true, author: { select: { role: true, isAlumni: true, formerUniversityId: true, formerProgramId: true } } },
          },
        },
      }),
    [],
    "search:universities"
  );
  return rows.map((u) => {
    const filtered = filterReviews(u.reviews, f);
    return {
      type: "university" as const,
      id: u.id,
      title: u.name,
      subtitle: [u.city, u.state].filter(Boolean).join(", "),
      rating: weightedAvg(filtered),
      reviewCount: filtered.length,
      href: `/university/${u.id}`,
      meta: {
        conference: u.conference ?? null,
        state: u.state ?? null,
      },
      __universityName: u.name,
    };
  });
}

async function searchDorms(
  q: string | undefined,
  f: SearchFilters,
  limit: number,
  ratingFilter: Prisma.DormWhereInput | undefined,
  aliasNames: string[],
  nameLikes: { contains: string; mode: "insensitive" }[]
): Promise<ScoredSearchHit[]> {
  // Dorms inherit their level from their university (which inherits via its
  // programs). Same join logic as universities.
  const programMatch: Prisma.SchoolWhereInput | undefined =
    f.division || f.sport
      ? {
          ...(f.division ? { division: f.division } : {}),
          ...(f.sport ? { sport: { equals: f.sport, mode: "insensitive" } } : {}),
        }
      : undefined;

  // Either the dorm name matches, OR the dorm belongs to a university whose
  // name matches the query / an alias. Lets "bama" surface Bryant Hall.
  const universityNameClauses: Prisma.UniversityWhereInput[] = nameLikes.map((c) => ({ name: c }));
  for (const n of aliasNames) universityNameClauses.push({ name: { equals: n, mode: "insensitive" } });

  const where: Prisma.DormWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              ...(universityNameClauses.length
                ? [{ university: { OR: universityNameClauses } }]
                : []),
            ],
          }
        : {},
      f.universityId ? { universityId: f.universityId } : {},
      programMatch ? { university: { schools: { some: programMatch } } } : {},
      f.state ? { university: { state: { equals: f.state, mode: "insensitive" } } } : {},
      f.conference
        ? {
            university: {
              OR: [
                { conference: { contains: f.conference, mode: "insensitive" } },
                { schools: { some: { conference: { contains: f.conference, mode: "insensitive" } } } },
              ],
            },
          }
        : {},
      ratingFilter ?? {},
    ],
  };
  const rows = await safe(
    () =>
      prisma.dorm.findMany({
        where,
        take: limit,
        include: {
          university: true,
          reviews: {
            select: { overall: true, weight: true, reviewType: true, author: { select: { role: true, isAlumni: true, formerUniversityId: true, formerProgramId: true } } },
          },
        },
      }),
    [],
    "search:dorms"
  );
  return rows.map((d) => {
    const filtered = filterReviews(d.reviews, f);
    return {
      type: "dorm" as const,
      id: d.id,
      title: d.name,
      subtitle: d.university.name,
      rating: weightedAvg(filtered),
      reviewCount: filtered.length,
      href: `/dorm/${d.id}`,
      __universityName: d.university.name,
    };
  });
}

async function searchSchools(
  q: string | undefined,
  f: SearchFilters,
  limit: number,
  ratingFilter: Prisma.SchoolWhereInput | undefined,
  aliasNames: string[],
  nameLikes: { contains: string; mode: "insensitive" }[]
): Promise<ScoredSearchHit[]> {
  const universityNameClauses: Prisma.UniversityWhereInput[] = nameLikes.map((c) => ({ name: c }));
  for (const n of aliasNames) universityNameClauses.push({ name: { equals: n, mode: "insensitive" } });

  const where: Prisma.SchoolWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { sport: { contains: q, mode: "insensitive" } },
              { conference: { contains: q, mode: "insensitive" } },
              ...(universityNameClauses.length
                ? [{ university: { OR: universityNameClauses } }]
                : []),
            ],
          }
        : {},
      f.sport ? { sport: { equals: f.sport, mode: "insensitive" } } : {},
      f.division ? { division: f.division } : {},
      f.universityId ? { universityId: f.universityId } : {},
      f.conference
        ? {
            OR: [
              { conference: { contains: f.conference, mode: "insensitive" } },
              { university: { conference: { contains: f.conference, mode: "insensitive" } } },
            ],
          }
        : {},
      f.state ? { university: { state: { equals: f.state, mode: "insensitive" } } } : {},
      ratingFilter ?? {},
    ],
  };
  const rows = await safe(
    () =>
      prisma.school.findMany({
        where,
        take: limit,
        include: {
          university: true,
          reviews: {
            select: { overall: true, weight: true, reviewType: true, author: { select: { role: true, isAlumni: true, formerUniversityId: true, formerProgramId: true } } },
          },
        },
      }),
    [],
    "search:schools"
  );
  return rows.map((s) => {
    const filtered = filterReviews(s.reviews, f);
    return {
      type: "school" as const,
      id: s.id,
      title: `${s.university.name} ${s.sport}`,
      subtitle: `${s.division} · ${s.conference ?? "Conference n/a"}`,
      rating: weightedAvg(filtered),
      reviewCount: filtered.length,
      href: `/school/${s.id}`,
      meta: {
        sport: s.sport,
        division: s.division,
        conference: s.conference ?? s.university.conference ?? null,
        schoolName: s.university.name,
        state: s.university.state ?? null,
      },
      __universityName: s.university.name,
    };
  });
}

function filterReviews<
  R extends {
    reviewType: ReviewType;
    weight: number;
    overall: number;
    author?: {
      role: string;
      isAlumni?: boolean | null;
      formerUniversityId?: string | null;
      formerProgramId?: string | null;
    } | null;
  }
>(reviews: R[], f: SearchFilters): R[] {
  // Pure helpers — inlined to avoid importing the lifecycle lib from this
  // performance-sensitive path. The role check covers reviews authored
  // before the `isAlumni` column existed.
  const isAlumniRow = (a: NonNullable<R["author"]> | undefined): boolean => {
    if (!a) return false;
    if (a.isAlumni === true) return true;
    return a.role === "VERIFIED_ATHLETE_ALUMNI" || a.role === "VERIFIED_STUDENT_ALUMNI";
  };

  return reviews.filter((r) => {
    if (f.reviewType && r.reviewType !== f.reviewType) return false;
    if (
      f.verifiedAthleteOnly &&
      r.author?.role !== "VERIFIED_ATHLETE" &&
      // Alumni count as athlete-trusted reviewers per the verification spec.
      r.author?.role !== "VERIFIED_ATHLETE_ALUMNI"
    )
      return false;
    if (f.parentReviewsOnly && r.author?.role !== "PARENT") return false;
    if (
      f.verifiedStudentOnly &&
      r.author?.role !== "VERIFIED_STUDENT" &&
      // Student alumni are student-trusted per the verification spec.
      r.author?.role !== "VERIFIED_STUDENT_ALUMNI"
    )
      return false;
    // Lifecycle filters. Mutually exclusive but both can be off, in which
    // case the filter is a no-op.
    if (f.currentOnly && isAlumniRow(r.author ?? undefined)) return false;
    if (f.alumniOnly && !isAlumniRow(r.author ?? undefined)) return false;
    // "Former players of X" — match the author's former-school pointer.
    if (
      f.formerUniversityId &&
      r.author?.formerUniversityId !== f.formerUniversityId
    )
      return false;
    if (
      f.formerProgramId &&
      r.author?.formerProgramId !== f.formerProgramId
    )
      return false;
    return true;
  });
}

function weightedAvg(reviews: { overall: number; weight: number }[]): number {
  if (!reviews.length) return 0;
  let totalWeight = 0;
  let sum = 0;
  for (const r of reviews) {
    if (!Number.isFinite(r.overall) || !Number.isFinite(r.weight)) continue;
    sum += r.overall * r.weight;
    totalWeight += r.weight;
  }
  return totalWeight === 0 ? 0 : Number((sum / totalWeight).toFixed(2));
}
