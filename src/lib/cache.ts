/**
 * Centralized read-cache layer.
 *
 * Why a single module:
 *   - Every cached Prisma read lives here, so we can audit cache keys,
 *     TTLs, and tag invalidation in one place.
 *   - Pages just import the function — no duplicated `unstable_cache`
 *     wrappers scattered through the app.
 *   - Adding a new cached read is one entry; tweaking a TTL is one
 *     constant edit.
 *
 * Tag invalidation strategy (called from mutation routes):
 *
 *   revalidateTag("reviews")        → busts uni/coach/dorm/school caches
 *                                     (review changes affect aggregate scores
 *                                      and visible review lists everywhere)
 *
 *   revalidateTag("search")         → busts the search results cache
 *                                     (called when content that surfaces in
 *                                      search is created/updated/deleted)
 *
 *   revalidateTag("universities")   → busts university profile + search
 *                                     (called when a uni row is edited,
 *                                      programs added, etc.)
 *
 * Note on per-id granularity: `unstable_cache` hashes its function args
 * with the keyParts, so `getCachedUniversityProfile("uni-123")` and
 * `getCachedUniversityProfile("uni-456")` get separate cache entries
 * automatically. The static tags here are intentionally coarse so a
 * single mutation (e.g. a new review) busts every profile that might
 * show that data — simpler than tracking which IDs were affected.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import type { SearchFilters } from "@/lib/search";
import { runSearch as runSearchRaw } from "@/lib/search";

// ---------------------------------------------------------------------------
// TTLs (seconds). Tuned for the kind of data each page shows.
// ---------------------------------------------------------------------------

/** Profile pages — uni/coach/dorm/school. Reviews drive these; reviews land
 *  rarely enough that 5 min is fine. Tag-based invalidation handles the
 *  immediate refresh when a review IS posted. */
const TTL_PROFILE = 300;

/** Search results. Highly query-dependent; we want them fresh enough that
 *  newly-added universities show up within the hour but cached enough that
 *  list views don't hammer the DB. */
const TTL_SEARCH = 60;

// ---------------------------------------------------------------------------
// University profile — the heavy query at /university/[id]
// ---------------------------------------------------------------------------

export const getCachedUniversityProfile = unstable_cache(
  async (id: string) =>
    safe(
      () =>
        prisma.university.findUnique({
          where: { id },
          include: {
            schools: {
              orderBy: { sport: "asc" },
              include: {
                coaches: {
                  orderBy: { name: "asc" },
                  include: {
                    reviews: {
                      where: { status: "PUBLISHED", moderationStatus: "PUBLISHED" },
                      select: { overall: true, weight: true },
                    },
                  },
                },
              },
            },
            dorms: { orderBy: { name: "asc" } },
            diningHalls: { orderBy: { name: "asc" } },
            facilities: { orderBy: { name: "asc" } },
            reviews: {
              where: { status: "PUBLISHED", moderationStatus: "PUBLISHED" },
              include: {
                author: {
                  select: { id: true, name: true, role: true, verificationStatus: true },
                },
              },
            },
          },
        }),
      null,
      "cache:university:findUnique"
    ),
  ["university-profile"],
  { revalidate: TTL_PROFILE, tags: ["reviews", "universities"] }
);

// ---------------------------------------------------------------------------
// Coach profile — /coach/[id]
// ---------------------------------------------------------------------------

export const getCachedCoachProfile = unstable_cache(
  async (id: string) =>
    safe(
      () =>
        prisma.coach.findUnique({
          where: { id },
          include: {
            school: { include: { university: true } },
            reviews: {
              where: { status: "PUBLISHED", moderationStatus: "PUBLISHED" },
              include: {
                author: {
                  select: { id: true, name: true, role: true, verificationStatus: true },
                },
              },
            },
          },
        }),
      null,
      "cache:coach:findUnique"
    ),
  ["coach-profile"],
  { revalidate: TTL_PROFILE, tags: ["reviews", "coaches"] }
);

// ---------------------------------------------------------------------------
// Dorm profile — /dorm/[id]
// ---------------------------------------------------------------------------

export const getCachedDormProfile = unstable_cache(
  async (id: string) =>
    safe(
      () =>
        prisma.dorm.findUnique({
          where: { id },
          include: {
            university: true,
            reviews: {
              where: { status: "PUBLISHED", moderationStatus: "PUBLISHED" },
              include: {
                author: {
                  select: { id: true, name: true, role: true, verificationStatus: true },
                },
              },
            },
          },
        }),
      null,
      "cache:dorm:findUnique"
    ),
  ["dorm-profile"],
  { revalidate: TTL_PROFILE, tags: ["reviews", "dorms"] }
);

// ---------------------------------------------------------------------------
// School (program) profile — /school/[id]
// ---------------------------------------------------------------------------

export const getCachedSchoolProfile = unstable_cache(
  async (id: string) =>
    safe(
      () =>
        prisma.school.findUnique({
          where: { id },
          include: {
            university: true,
            coaches: {
              orderBy: { name: "asc" },
              include: {
                reviews: {
                  where: { status: "PUBLISHED", moderationStatus: "PUBLISHED" },
                  select: { overall: true, weight: true },
                },
              },
            },
            reviews: {
              where: { status: "PUBLISHED", moderationStatus: "PUBLISHED" },
              include: {
                author: {
                  select: { id: true, name: true, role: true, verificationStatus: true },
                },
              },
            },
          },
        }),
      null,
      "cache:school:findUnique"
    ),
  ["school-profile"],
  { revalidate: TTL_PROFILE, tags: ["reviews", "schools"] }
);

// ---------------------------------------------------------------------------
// Search — used by /search and /
// ---------------------------------------------------------------------------

/**
 * Cached wrapper around runSearch. The filters object is serialized
 * automatically by unstable_cache for the cache key, so different filter
 * combinations get separate entries. TTL is short because new content
 * should surface in search reasonably fast.
 */
export const getCachedSearchResults = unstable_cache(
  async (filters: SearchFilters) => runSearchRaw(filters),
  ["search-results"],
  { revalidate: TTL_SEARCH, tags: ["search", "universities", "coaches", "dorms", "schools"] }
);
