import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canParticipate,
  canSubmitReviewType,
  describeGate,
  getSession,
  whyCannotParticipate,
} from "@/lib/permissions";
import { reviewSubmissionSchema } from "@/lib/review-schemas";
import { deriveOverall, weightForRole } from "@/lib/review-weighting";
import { rateLimit } from "@/lib/rate-limit";
import { safe } from "@/lib/safe-query";
import { describeReviewBlock } from "@/lib/connection-permissions";
import { loadReviewRiskContext, scoreReview } from "@/lib/review-risk";
import { sendModerationAlertEmail } from "@/lib/email/notifications";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import {
  Prisma,
  ReviewModerationStatus,
  ReviewStatus,
  ReviewType,
} from "@prisma/client";

export async function POST(req: Request) {
  const session = await getSession();
  const gate = whyCannotParticipate(session);
  if (gate) {
    return NextResponse.json({ error: describeGate(gate) }, { status: 403 });
  }

  // 10 reviews / 10 min per user — well above any honest cadence.
  const limited = rateLimit(req, "review:create", {
    max: 10,
    windowMs: 10 * 60_000,
    identifier: session!.user.id,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reviewSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.warn("[api/reviews] schema rejection", parsed.error.flatten());
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const userId = session!.user.id;
  const role = session!.user.role;

  // eslint-disable-next-line no-console
  console.info("[api/reviews] received", {
    userId,
    role,
    reviewType: data.reviewType,
    coachId: data.coachId ?? null,
    schoolId: data.schoolId ?? null,
    universityId: data.universityId ?? null,
    dormId: data.dormId ?? null,
  });

  // Per-role review-type gate.
  if (!canSubmitReviewType(session, data.reviewType)) {
    // eslint-disable-next-line no-console
    console.info("[api/reviews] permission decision: BLOCKED at role gate", {
      userId,
      role,
      reviewType: data.reviewType,
    });
    return NextResponse.json(
      { error: describeGate("wrong-role", { reviewType: data.reviewType }) },
      { status: 403 }
    );
  }

  // Per-target gate — "athletes can only review programs they're connected
  // to" lives in connection-permissions.ts so the API and UI share the rule.
  // Admins bypass automatically. The block message is forwarded verbatim.
  const block = await describeReviewBlock(
    { id: userId, role },
    data.reviewType,
    {
      coachId: data.coachId ?? null,
      schoolId: data.schoolId ?? null,
      universityId: data.universityId ?? null,
      dormId: data.dormId ?? null,
    }
  );
  if (block) {
    // eslint-disable-next-line no-console
    console.info("[api/reviews] permission decision: BLOCKED at per-target gate", {
      userId,
      reviewType: data.reviewType,
      schoolId: data.schoolId ?? null,
      universityId: data.universityId ?? null,
      coachId: data.coachId ?? null,
      reason: block,
    });
    return NextResponse.json({ error: block }, { status: 403 });
  }
  // eslint-disable-next-line no-console
  console.info("[api/reviews] permission decision: ALLOWED", {
    userId,
    reviewType: data.reviewType,
  });

  const overall = deriveOverall(data.ratings);
  const weight = weightForRole(role);

  // ---- Anti-fake risk scoring ----
  // Loads the per-author signals + runs the rule-based scorer.
  // Output decides the moderationStatus: PUBLISHED for low risk,
  // PENDING_REVIEW for medium, FLAGGED for high (or anything that
  // tripped a harassment pattern).
  const riskContext = await loadReviewRiskContext({
    userId,
    schoolId: data.schoolId ?? null,
    universityId: data.universityId ?? null,
    coachId: data.coachId ?? null,
  });
  const risk = riskContext
    ? scoreReview({
        submission: {
          body: data.body,
          ratings: data.ratings as Record<string, number | null | undefined>,
          reviewType: data.reviewType,
        },
        context: riskContext,
      })
    : // Defensive: if we couldn't load context (shouldn't happen — the
      // session-user lookup would have to silently fail), be safe and
      // hold the review for human review rather than auto-publishing.
      {
        trustScore: 0,
        riskScore: 100,
        reasons: [
          {
            key: "context_load_failed",
            weight: 100,
            applied: true,
          },
        ],
        moderationStatus: ReviewModerationStatus.PENDING_REVIEW,
        containsHarassment: false,
      };

  // eslint-disable-next-line no-console
  console.info("[api/reviews] risk", {
    userId,
    trustScore: risk.trustScore,
    riskScore: risk.riskScore,
    moderationStatus: risk.moderationStatus,
    appliedReasons: risk.reasons
      .filter((r) => r.applied)
      .map((r) => r.key),
  });

  const review = await prisma.review.create({
    data: {
      authorId: userId,
      reviewType: data.reviewType,
      title: data.title,
      body: data.body,
      coachId: data.coachId,
      schoolId: data.schoolId,
      universityId: data.universityId,
      dormId: data.dormId,
      ratings: data.ratings as Prisma.InputJsonValue,
      overall,
      weight,
      isAnonymous: data.isAnonymous,
      // `status` (PUBLISHED/HIDDEN/REMOVED) is the legacy column —
      // hide PENDING/FLAGGED rows there too so existing public list
      // queries that filter `status: PUBLISHED` already exclude them
      // without needing every callsite updated. Removed here means
      // "not in the public feed"; the new moderationStatus carries
      // the precise reason.
      status:
        risk.moderationStatus === ReviewModerationStatus.PUBLISHED
          ? ReviewStatus.PUBLISHED
          : ReviewStatus.HIDDEN,
      trustScore: risk.trustScore,
      riskScore: risk.riskScore,
      credibilityReason: risk.reasons as unknown as Prisma.InputJsonValue,
      moderationStatus: risk.moderationStatus,
    },
  });

  // eslint-disable-next-line no-console
  console.info("[api/reviews] created", {
    reviewId: review.id,
    authorId: userId,
    reviewType: data.reviewType,
    coachId: data.coachId ?? null,
    schoolId: data.schoolId ?? null,
    universityId: data.universityId ?? null,
    dormId: data.dormId ?? null,
    overall,
    weight,
    moderationStatus: risk.moderationStatus,
    riskScore: risk.riskScore,
  });

  // High-risk submissions get an email to the admin team + an audit
  // log entry so the moderation queue isn't the only signal. Pending
  // submissions stay quiet (they just queue up); only FLAGGED pages
  // the admins.
  if (risk.moderationStatus === ReviewModerationStatus.FLAGGED) {
    await logAdminAction({
      actorUserId: null,
      action: AUDIT_ACTIONS.REVIEW_FLAGGED,
      targetType: "Review",
      targetId: review.id,
      metadata: {
        riskScore: risk.riskScore,
        reasons: risk.reasons.filter((r) => r.applied).map((r) => r.key),
        containsHarassment: risk.containsHarassment,
      },
    });
    void (async () => {
      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      await sendModerationAlertEmail({
        target: "review",
        targetId: review.id,
        reportId: review.id, // placeholder — no Report row for auto-flag
        reason: risk.containsHarassment
          ? "harassment-keyword"
          : `auto-risk score ${risk.riskScore}`,
        totalReports: 0,
        reporterName: me?.name ?? null,
        reporterEmail: me?.email ?? null,
        thresholdExceeded: true,
      });
    })();
  }

  // User-facing message — the form surfaces this verbatim.
  const note =
    risk.moderationStatus === ReviewModerationStatus.PUBLISHED
      ? "Submitted."
      : risk.moderationStatus === ReviewModerationStatus.PENDING_REVIEW
      ? "Your review was submitted and is pending moderation."
      : "Your review was submitted but flagged for review by an admin before it can be published.";

  return NextResponse.json(
    {
      id: review.id,
      moderationStatus: risk.moderationStatus,
      note,
    },
    { status: 201 }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const reviewType = url.searchParams.get("type") as ReviewType | null;
  const targetId = url.searchParams.get("targetId");
  // Default 100 reviews per query, capped at 500.
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? 100)), 500);

  if (!reviewType || !targetId) {
    return NextResponse.json({ error: "type and targetId are required" }, { status: 400 });
  }

  // Only fully-published reviews surface publicly. Filtering on BOTH
  // columns is belt-and-suspenders: the submit path keeps `status` in
  // sync with `moderationStatus`, but a future admin action could
  // toggle one without the other and we'd rather hide than over-show.
  const where: Prisma.ReviewWhereInput = {
    status: ReviewStatus.PUBLISHED,
    moderationStatus: ReviewModerationStatus.PUBLISHED,
    reviewType,
  };
  if (reviewType === ReviewType.COACH) where.coachId = targetId;
  if (reviewType === ReviewType.PROGRAM) where.schoolId = targetId;
  if (reviewType === ReviewType.RECRUITING) where.schoolId = targetId;
  if (reviewType === ReviewType.UNIVERSITY) where.universityId = targetId;
  if (reviewType === ReviewType.ADMISSIONS) where.universityId = targetId;
  if (reviewType === ReviewType.DORM) where.dormId = targetId;
  if (reviewType === ReviewType.PARENT_INSIGHT) {
    where.OR = [{ coachId: targetId }, { schoolId: targetId }];
  }

  const reviews = await safe(
    () =>
      prisma.review.findMany({
        where,
        take: limit,
        orderBy: [{ weight: "desc" }, { helpfulCount: "desc" }, { createdAt: "desc" }],
        include: {
          author: { select: { id: true, role: true, verificationStatus: true } },
        },
      }),
    [],
    "reviews:list"
  );

  return NextResponse.json({ reviews });
}
