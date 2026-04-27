import { prisma } from "@/lib/prisma";
import { Division, Prisma, ReviewType } from "@prisma/client";

export type SearchKind = "all" | "coach" | "university" | "dorm" | "school";

export interface SearchFilters {
  q?: string;
  kind?: SearchKind;
  sport?: string;
  division?: Division;
  universityId?: string;
  minRating?: number;
  reviewType?: ReviewType;
  verifiedAthleteOnly?: boolean;
  parentReviewsOnly?: boolean;
  verifiedStudentOnly?: boolean;
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
}

const DEFAULT_LIMIT = 20;

export async function runSearch(f: SearchFilters): Promise<SearchHit[]> {
  const limit = Math.min(f.limit ?? DEFAULT_LIMIT, 50);
  const q = f.q?.trim();

  const ratingFilter = f.minRating
    ? { reviews: { some: { overall: { gte: f.minRating } } } }
    : undefined;

  const promises: Promise<SearchHit[]>[] = [];

  if (!f.kind || f.kind === "all" || f.kind === "coach") {
    promises.push(searchCoaches(q, f, limit, ratingFilter));
  }
  if (!f.kind || f.kind === "all" || f.kind === "university") {
    promises.push(searchUniversities(q, f, limit, ratingFilter));
  }
  if (!f.kind || f.kind === "all" || f.kind === "dorm") {
    promises.push(searchDorms(q, f, limit, ratingFilter));
  }
  if (!f.kind || f.kind === "all" || f.kind === "school") {
    promises.push(searchSchools(q, f, limit, ratingFilter));
  }

  const results = (await Promise.all(promises)).flat();
  return results.slice(0, limit);
}

async function searchCoaches(
  q: string | undefined,
  f: SearchFilters,
  limit: number,
  ratingFilter: Prisma.CoachWhereInput | undefined
): Promise<SearchHit[]> {
  const where: Prisma.CoachWhereInput = {
    AND: [
      q ? { name: { contains: q, mode: "insensitive" } } : {},
      f.sport ? { school: { sport: { equals: f.sport, mode: "insensitive" } } } : {},
      f.division ? { school: { division: f.division } } : {},
      f.universityId ? { school: { universityId: f.universityId } } : {},
      ratingFilter ?? {},
    ],
  };

  const rows = await prisma.coach.findMany({
    where,
    take: limit,
    include: {
      school: { include: { university: true } },
      reviews: {
        select: { overall: true, weight: true, reviewType: true, author: { select: { role: true } } },
      },
    },
  });

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
    };
  });
}

async function searchUniversities(
  q: string | undefined,
  f: SearchFilters,
  limit: number,
  ratingFilter: Prisma.UniversityWhereInput | undefined
): Promise<SearchHit[]> {
  const where: Prisma.UniversityWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { state: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      ratingFilter ?? {},
    ],
  };
  const rows = await prisma.university.findMany({
    where,
    take: limit,
    include: {
      reviews: {
        select: { overall: true, weight: true, reviewType: true, author: { select: { role: true } } },
      },
    },
  });
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
    };
  });
}

async function searchDorms(
  q: string | undefined,
  f: SearchFilters,
  limit: number,
  ratingFilter: Prisma.DormWhereInput | undefined
): Promise<SearchHit[]> {
  const where: Prisma.DormWhereInput = {
    AND: [
      q ? { name: { contains: q, mode: "insensitive" } } : {},
      f.universityId ? { universityId: f.universityId } : {},
      ratingFilter ?? {},
    ],
  };
  const rows = await prisma.dorm.findMany({
    where,
    take: limit,
    include: {
      university: true,
      reviews: {
        select: { overall: true, weight: true, reviewType: true, author: { select: { role: true } } },
      },
    },
  });
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
    };
  });
}

async function searchSchools(
  q: string | undefined,
  f: SearchFilters,
  limit: number,
  ratingFilter: Prisma.SchoolWhereInput | undefined
): Promise<SearchHit[]> {
  const where: Prisma.SchoolWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { sport: { contains: q, mode: "insensitive" } },
              { university: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {},
      f.sport ? { sport: { equals: f.sport, mode: "insensitive" } } : {},
      f.division ? { division: f.division } : {},
      f.universityId ? { universityId: f.universityId } : {},
      ratingFilter ?? {},
    ],
  };
  const rows = await prisma.school.findMany({
    where,
    take: limit,
    include: {
      university: true,
      reviews: {
        select: { overall: true, weight: true, reviewType: true, author: { select: { role: true } } },
      },
    },
  });
  return rows.map((s) => {
    const filtered = filterReviews(s.reviews, f);
    return {
      type: "school" as const,
      id: s.id,
      title: `${s.university.name} ${s.sport}`,
      subtitle: `${s.division} · ${s.conference ?? "Conference n/a"}`,
      rating: weightedAvg(filtered),
      reviewCount: filtered.length,
      href: `/university/${s.universityId}?sport=${encodeURIComponent(s.sport)}`,
    };
  });
}

function filterReviews<
  R extends {
    reviewType: ReviewType;
    weight: number;
    overall: number;
    author?: { role: string } | null;
  }
>(reviews: R[], f: SearchFilters): R[] {
  return reviews.filter((r) => {
    if (f.reviewType && r.reviewType !== f.reviewType) return false;
    if (f.verifiedAthleteOnly && r.author?.role !== "VERIFIED_ATHLETE") return false;
    if (f.parentReviewsOnly && r.author?.role !== "PARENT") return false;
    if (f.verifiedStudentOnly && r.author?.role !== "VERIFIED_STUDENT") return false;
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
