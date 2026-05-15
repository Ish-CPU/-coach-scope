import type { Review, UserRole } from "@prisma/client";

/**
 * Weights:
 *   Verified Athlete         = 2.00  (current college athlete)
 *   Verified Athlete Alumni  = 1.75  (former college athlete — slightly less
 *                                     than current per the verification spec
 *                                     so present-day program reality dominates,
 *                                     while still surfacing experienced voices)
 *   Verified Student         = 1.25
 *   Verified Student Alumni  = 1.10  (former student — slightly less than
 *                                     current students, parallel to the
 *                                     athlete / athlete-alumni gap)
 *   Verified Parent          = 1.25  (for insights where applicable)
 *
 * Anything else (Viewer, Admin without role context) defaults to 1.0
 * but only verified, paid roles can submit, so this is just a safety floor.
 */
export const REVIEW_WEIGHTS = {
  VERIFIED_ATHLETE: 2.0,
  VERIFIED_ATHLETE_ALUMNI: 1.75,
  VERIFIED_STUDENT: 1.25,
  VERIFIED_STUDENT_ALUMNI: 1.1,
  VERIFIED_PARENT: 1.25,
  // Recruits write only RECRUITING reviews — for that specific surface
  // they're the canonical first-person source (they were actually
  // recruited), so they weight on par with current students rather than
  // alumni. Their lack of any other review surface keeps their influence
  // narrow regardless.
  VERIFIED_RECRUIT: 1.25,
  VIEWER: 1.0,
  ADMIN: 1.0,
  // Master admin reviews are an edge case (admins rarely post user-facing
  // reviews). Treat them like staff admins for weighting parity.
  MASTER_ADMIN: 1.0,
} as const satisfies Record<UserRole, number>;

export function weightForRole(role: UserRole): number {
  return REVIEW_WEIGHTS[role] ?? 1.0;
}

// ---------------------------------------------------------------------------
// Weighted average — single source of truth used everywhere
// ---------------------------------------------------------------------------

export function calculateWeightedAverage(
  items: { value: number; weight: number }[]
): number {
  if (items.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const r of items) {
    if (!Number.isFinite(r.value) || !Number.isFinite(r.weight)) continue;
    weightedSum += r.value * r.weight;
    totalWeight += r.weight;
  }
  return totalWeight === 0 ? 0 : Number((weightedSum / totalWeight).toFixed(2));
}

// Back-compat aliases
export const weightedAverage = calculateWeightedAverage;

export function weightedCategoryAverage(
  reviews: Pick<Review, "weight" | "ratings">[],
  category: string
): number {
  const items = reviews
    .map((r) => {
      const raw = (r.ratings as Record<string, unknown> | null)?.[category];
      // N/A handling: `null` (explicit "Not applicable") and `undefined`
      // (legacy / missing key) are both excluded from the average. Without
      // this short-circuit `Number(null)` would silently coerce to 0 and
      // tank the category's score.
      if (raw === null || raw === undefined) return null;
      const value = typeof raw === "number" ? raw : Number(raw);
      // Defensive lower bound — a legacy 0 is also treated as N/A so old
      // bad data doesn't produce a spurious low score.
      return Number.isFinite(value) && value > 0
        ? { weight: r.weight, value }
        : null;
    })
    .filter((x): x is { weight: number; value: number } => !!x);

  return calculateWeightedAverage(items);
}

export function weightedOverall(reviews: Pick<Review, "weight" | "overall">[]): number {
  return calculateWeightedAverage(reviews.map((r) => ({ weight: r.weight, value: r.overall })));
}

// ---------------------------------------------------------------------------
// Grade + percentage helpers
// ---------------------------------------------------------------------------

export function convertRatingToPercentage(rating: number): number {
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  const clamped = Math.min(5, Math.max(0, rating));
  return Number(((clamped / 5) * 100).toFixed(1));
}

export function convertRatingToLetterGrade(rating: number): string {
  if (!Number.isFinite(rating) || rating < 1.0) return "F";
  if (rating >= 4.7) return "A+";
  if (rating >= 4.3) return "A";
  if (rating >= 4.0) return "A-";
  if (rating >= 3.7) return "B+";
  if (rating >= 3.3) return "B";
  if (rating >= 3.0) return "B-";
  if (rating >= 2.7) return "C+";
  if (rating >= 2.3) return "C";
  if (rating >= 2.0) return "C-";
  if (rating >= 1.7) return "D+";
  if (rating >= 1.3) return "D";
  if (rating >= 1.0) return "D-";
  return "F";
}

export function gradeBlock(rating: number) {
  return {
    rating: Number((rating ?? 0).toFixed(2)),
    percentage: convertRatingToPercentage(rating),
    letter: convertRatingToLetterGrade(rating),
  };
}

// ---------------------------------------------------------------------------
// Review sorting + overall derivation
// ---------------------------------------------------------------------------

export function defaultReviewSort<
  T extends Pick<Review, "weight" | "helpfulCount" | "createdAt">
>(reviews: T[]): T[] {
  return [...reviews].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (b.helpfulCount !== a.helpfulCount) return b.helpfulCount - a.helpfulCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function deriveOverall(ratings: Record<string, unknown>): number {
  // Headline categories must be a real number per review-schemas.ts — use
  // them as-is when present.
  const explicit = ratings.overallRating ?? ratings.overallExperience;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Number(explicit.toFixed(2));
  }
  // Fallback: average across the remaining categories, dropping null
  // (intentional N/A) and undefined (legacy / missing) entries so an
  // N/A doesn't drag the overall down.
  const values = Object.values(ratings)
    .filter((v) => v !== null && v !== undefined)
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return 0;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}
