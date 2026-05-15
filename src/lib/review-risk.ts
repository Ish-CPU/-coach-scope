import { prisma } from "@/lib/prisma";
import { isAthleteTrustedRole, isStudentTrustedRole } from "@/lib/permissions";
import {
  ReviewModerationStatus,
  ReviewType,
  UserRole,
  VerificationStatus,
} from "@prisma/client";

/**
 * Anti-fake review risk scorer.
 *
 * Pure rule-based, no AI dependency. The scorer is split into two
 * pieces so it's easy to test and easy to adjust later:
 *
 *   1. `loadReviewRiskContext(...)` — pulls the per-author signals
 *      from Prisma (account age, prior review activity, recent open
 *      reports against this user, whether they have a connection to
 *      the target). One-shot DB call set, called from /api/reviews POST.
 *   2. `scoreReview(input)` — pure synchronous function. Takes the
 *      context + the submission shape and returns
 *      `{ trustScore, riskScore, reasons, moderationStatus }`.
 *
 * Tuning:
 *   - All weights are constants at the top of the file. Bump them and
 *     re-run; no callers need to change.
 *   - Thresholds at the bottom map riskScore → moderationStatus.
 *   - Harassment / threat keywords are a hard FLAGGED trigger
 *     regardless of score.
 *
 * Output `credibilityReason` JSON is an array of `{ key, weight, applied,
 * note }` so admins can see exactly why a review landed where it did.
 */

// ---------------------------------------------------------------------------
// Tuning knobs — adjust these and rebuild
// ---------------------------------------------------------------------------

// Age (days) below which an account is "new" — risk weight applies.
const NEW_ACCOUNT_DAYS = 7;
// Age above which an account counts as "mature" — trust weight applies.
const MATURE_ACCOUNT_DAYS = 90;
// "Rapid posting" — number of reviews by this user in the last 24h
// that trips the risk weight.
const RAPID_POST_24H_THRESHOLD = 3;
// Open-reports-against-author count that flags repeat offenders.
const RECENT_REPORT_THRESHOLD = 2;
const REPORT_LOOKBACK_DAYS = 30;
// Rough body-length floor below which an extreme rating reads as
// "drive-by" — added on top of the rating-extremity weight.
const SHORT_BODY_CHARS = 50;
// Risk score buckets → moderation status.
const RISK_PENDING_THRESHOLD = 30; // < this → publish
const RISK_FLAGGED_THRESHOLD = 70; // ≥ this → flag

// Per-rule risk weights. Keep grouped by category so it's easy to reason
// about absolute totals when tuning.
const W = {
  newAccount: 25,
  noConnection: 20,
  rapidPosting: 15,
  recentReports: 25,
  duplicateBody: 30,
  extremeShort: 15,
  ratingExtremity: 10,
  harassment: 60, // hard floor for FLAGGED
  rejectedHistory: 15,
} as const;

// Per-rule trust weights (subtracted from a baseline of 50).
const T = {
  verified: 20,
  approvedConnection: 25,
  matureAccount: 10,
  helpfulHistory: 10,
  cleanReportHistory: 5,
} as const;

// Harassment / threat / slur signals. Intentionally short + obvious
// — the goal is "auto-flag the worst stuff for human review", not
// "perfect classifier." Add to this list as patterns emerge in
// moderation. Word-boundary regex so "kill" matches "kill yourself"
// but not "skill."
const HARASSMENT_PATTERNS: RegExp[] = [
  /\bkill\s+yourself\b/i,
  /\bkys\b/i,
  /\bgo\s+die\b/i,
  /\bshould\s+(be\s+)?dead\b/i,
  /\b(rape|raped|raping|rapist)\b/i,
  /\bnigger\b/i,
  /\bfaggot\b/i,
  /\bretard\b/i,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreableSubmission {
  body: string;
  ratings: Record<string, number | null | undefined>;
  reviewType: ReviewType;
}

export interface ReviewRiskContext {
  /** Author user. */
  user: {
    id: string;
    role: UserRole;
    verificationStatus: VerificationStatus;
    createdAt: Date;
    /** Cached per-user trust score from earlier work. May be 0. */
    trustScore: number;
  };
  /** Author has at least one APPROVED connection to the target school/uni. */
  hasApprovedConnectionToTarget: boolean;
  /** Reviews authored by this user in the last 24h. */
  reviewsLast24h: number;
  /** Count of OPEN reports against this user in the last 30 days. */
  openReportsAgainstUserRecent: number;
  /** Count of past reviews by this user that ended REMOVED. */
  removedReviewCount: number;
  /** Sum of helpful votes received across all of this user's reviews. */
  totalHelpfulVotes: number;
  /**
   * Last few bodies authored by this user for cheap duplicate detection.
   * Compared against the new submission via normalized hash equality.
   */
  recentBodyHashes: string[];
}

export interface CredibilityReason {
  key: string;
  weight: number;
  applied: boolean;
  note?: string;
}

export interface RiskOutcome {
  trustScore: number;
  riskScore: number;
  reasons: CredibilityReason[];
  moderationStatus: ReviewModerationStatus;
  /** Convenience flag for the API: did anything trip the harassment hard floor? */
  containsHarassment: boolean;
}

// ---------------------------------------------------------------------------
// Pure scoring
// ---------------------------------------------------------------------------

/**
 * Cheap normalized hash for duplicate-body detection. Lowercases,
 * collapses whitespace, drops non-alphanumerics. Two pieces of
 * substantively identical text hash the same; minor edits don't trip
 * the rule.
 */
export function bodyFingerprint(body: string): string {
  return body
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);
}

function hasExtremeRating(
  ratings: Record<string, number | null | undefined>
): boolean {
  // "Extreme" = the headline overall is at the floor or ceiling.
  const headline =
    typeof ratings.overallRating === "number"
      ? ratings.overallRating
      : typeof ratings.overallExperience === "number"
      ? ratings.overallExperience
      : null;
  if (headline === null) return false;
  return headline <= 1 || headline >= 5;
}

export function scoreReview(input: {
  submission: ScoreableSubmission;
  context: ReviewRiskContext;
}): RiskOutcome {
  const { submission, context } = input;
  const reasons: CredibilityReason[] = [];

  // ---- Trust signals (subtract from risk indirectly, build trustScore) ----
  let trustScore = 50;

  const isVerified =
    context.user.verificationStatus === VerificationStatus.VERIFIED;
  pushReason(reasons, "verified_role", T.verified, isVerified);
  if (isVerified) trustScore += T.verified;

  pushReason(
    reasons,
    "approved_connection_to_target",
    T.approvedConnection,
    context.hasApprovedConnectionToTarget
  );
  if (context.hasApprovedConnectionToTarget) trustScore += T.approvedConnection;

  const accountAgeDays = daysBetween(context.user.createdAt, new Date());
  const matureAccount = accountAgeDays >= MATURE_ACCOUNT_DAYS;
  pushReason(reasons, "mature_account", T.matureAccount, matureAccount, {
    note: `account age ${Math.round(accountAgeDays)}d`,
  });
  if (matureAccount) trustScore += T.matureAccount;

  const helpfulSignal = context.totalHelpfulVotes >= 5;
  pushReason(reasons, "helpful_history", T.helpfulHistory, helpfulSignal, {
    note: `helpful votes received: ${context.totalHelpfulVotes}`,
  });
  if (helpfulSignal) trustScore += T.helpfulHistory;

  const cleanReports = context.openReportsAgainstUserRecent === 0;
  pushReason(
    reasons,
    "clean_report_history",
    T.cleanReportHistory,
    cleanReports
  );
  if (cleanReports) trustScore += T.cleanReportHistory;

  // ---- Risk signals ----
  let riskScore = 0;

  const newAccount = accountAgeDays < NEW_ACCOUNT_DAYS;
  pushReason(reasons, "new_account", W.newAccount, newAccount, {
    note: `account age ${Math.round(accountAgeDays)}d`,
  });
  if (newAccount) riskScore += W.newAccount;

  // No-connection penalty only meaningful for roles that *expect* one
  // (athletes / students). Recruits + admins skip — recruits have a
  // narrower review surface, admins always pass.
  const expectsConnection =
    isAthleteTrustedRole(context.user.role) ||
    isStudentTrustedRole(context.user.role);
  if (expectsConnection) {
    const noConnection = !context.hasApprovedConnectionToTarget;
    pushReason(reasons, "no_connection_to_target", W.noConnection, noConnection);
    if (noConnection) riskScore += W.noConnection;
  }

  const rapid = context.reviewsLast24h >= RAPID_POST_24H_THRESHOLD;
  pushReason(reasons, "rapid_posting", W.rapidPosting, rapid, {
    note: `${context.reviewsLast24h} reviews in last 24h`,
  });
  if (rapid) riskScore += W.rapidPosting;

  const reportsTrip =
    context.openReportsAgainstUserRecent >= RECENT_REPORT_THRESHOLD;
  pushReason(reasons, "recent_reports_against_user", W.recentReports, reportsTrip, {
    note: `${context.openReportsAgainstUserRecent} open reports in last ${REPORT_LOOKBACK_DAYS}d`,
  });
  if (reportsTrip) riskScore += W.recentReports;

  const fingerprint = bodyFingerprint(submission.body);
  const isDuplicate =
    fingerprint.length > 20 && context.recentBodyHashes.includes(fingerprint);
  pushReason(reasons, "duplicate_body", W.duplicateBody, isDuplicate, {
    note: isDuplicate ? "matches a prior review by this user" : undefined,
  });
  if (isDuplicate) riskScore += W.duplicateBody;

  const extreme = hasExtremeRating(submission.ratings);
  const short = submission.body.length < SHORT_BODY_CHARS;
  if (extreme && short) {
    pushReason(reasons, "extreme_rating_short_body", W.extremeShort, true, {
      note: `${submission.body.length} chars`,
    });
    riskScore += W.extremeShort;
  } else if (extreme) {
    pushReason(reasons, "rating_extremity", W.ratingExtremity, true);
    riskScore += W.ratingExtremity;
  } else {
    pushReason(reasons, "rating_extremity", W.ratingExtremity, false);
  }

  const rejectedHistorySignal = context.removedReviewCount >= 2;
  pushReason(
    reasons,
    "prior_removed_reviews",
    W.rejectedHistory,
    rejectedHistorySignal,
    { note: `${context.removedReviewCount} removed historically` }
  );
  if (rejectedHistorySignal) riskScore += W.rejectedHistory;

  // Hard floor: harassment patterns auto-FLAG regardless of score.
  const containsHarassment = HARASSMENT_PATTERNS.some((re) =>
    re.test(submission.body)
  );
  pushReason(reasons, "harassment_keyword", W.harassment, containsHarassment);
  if (containsHarassment) riskScore += W.harassment;

  // Clamp + bucket.
  trustScore = Math.max(0, Math.min(100, trustScore));
  riskScore = Math.max(0, Math.min(100, riskScore));

  let moderationStatus: ReviewModerationStatus = ReviewModerationStatus.PUBLISHED;
  if (containsHarassment || riskScore >= RISK_FLAGGED_THRESHOLD) {
    moderationStatus = ReviewModerationStatus.FLAGGED;
  } else if (riskScore >= RISK_PENDING_THRESHOLD) {
    moderationStatus = ReviewModerationStatus.PENDING_REVIEW;
  }

  return {
    trustScore,
    riskScore,
    reasons,
    moderationStatus,
    containsHarassment,
  };
}

function pushReason(
  out: CredibilityReason[],
  key: string,
  weight: number,
  applied: boolean,
  extra?: { note?: string }
) {
  out.push({ key, weight, applied, note: extra?.note });
}

// ---------------------------------------------------------------------------
// Context loader (Prisma-side)
// ---------------------------------------------------------------------------

/**
 * Pull every signal the scorer needs in one call site. Returns null
 * when the user can't be loaded (caller should treat as "max risk").
 */
export async function loadReviewRiskContext(input: {
  userId: string;
  /** target ids on the submission — drives the connection-presence check */
  schoolId?: string | null;
  universityId?: string | null;
  coachId?: string | null;
}): Promise<ReviewRiskContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      role: true,
      verificationStatus: true,
      createdAt: true,
      trustScore: true,
    },
  });
  if (!user) return null;

  // Resolve the universityId from the target ids if we don't have it
  // — we use it to ask "do you have an APPROVED connection to this uni?"
  let universityId = input.universityId ?? null;
  let schoolId = input.schoolId ?? null;
  if (!universityId && schoolId) {
    const s = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { universityId: true },
    });
    universityId = s?.universityId ?? null;
  }
  if (!universityId && input.coachId) {
    const c = await prisma.coach.findUnique({
      where: { id: input.coachId },
      select: { school: { select: { universityId: true } } },
    });
    universityId = c?.school?.universityId ?? null;
  }

  const since30d = new Date(Date.now() - REPORT_LOOKBACK_DAYS * 86_400_000);
  const since24h = new Date(Date.now() - 86_400_000);

  const [
    athleteConn,
    studentConn,
    reviewsLast24h,
    openReportsAgainstUserRecent,
    removedReviewCount,
    totalHelpfulVotes,
    priorBodies,
  ] = await Promise.all([
    universityId
      ? prisma.athleteProgramConnection.findFirst({
          where: {
            userId: user.id,
            universityId,
            status: "APPROVED",
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    universityId
      ? prisma.studentUniversityConnection.findFirst({
          where: {
            userId: user.id,
            universityId,
            status: "APPROVED",
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.review.count({
      where: { authorId: user.id, createdAt: { gte: since24h } },
    }),
    prisma.report.count({
      where: {
        // Reports against any review/post/comment authored by this user
        // — the relations on Report don't directly tie to author, so
        // we fan out via the review/post/comment authorId. For MVP we
        // approximate as: open reports linking to a Review by this user.
        review: { authorId: user.id },
        status: "OPEN",
        createdAt: { gte: since30d },
      },
    }),
    prisma.review.count({
      where: { authorId: user.id, status: "REMOVED" },
    }),
    prisma.helpfulVote.count({
      where: { review: { authorId: user.id } },
    }),
    prisma.review.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { body: true },
    }),
  ]);

  return {
    user,
    hasApprovedConnectionToTarget: !!(athleteConn || studentConn),
    reviewsLast24h,
    openReportsAgainstUserRecent,
    removedReviewCount,
    totalHelpfulVotes,
    recentBodyHashes: priorBodies.map((r) => bodyFingerprint(r.body)),
  };
}
