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
import { Prisma, ReviewStatus, ReviewType } from "@prisma/client";

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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const userId = session!.user.id;
  const role = session!.user.role;

  // Per-role review-type gate.
  if (!canSubmitReviewType(session, data.reviewType)) {
    return NextResponse.json(
      { error: describeGate("wrong-role", { reviewType: data.reviewType }) },
      { status: 403 }
    );
  }

  const overall = deriveOverall(data.ratings);
  const weight = weightForRole(role);

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
      status: ReviewStatus.PUBLISHED,
    },
  });

  return NextResponse.json({ id: review.id }, { status: 201 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const reviewType = url.searchParams.get("type") as ReviewType | null;
  const targetId = url.searchParams.get("targetId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);

  if (!reviewType || !targetId) {
    return NextResponse.json({ error: "type and targetId are required" }, { status: 400 });
  }

  const where: Prisma.ReviewWhereInput = { status: ReviewStatus.PUBLISHED, reviewType };
  if (reviewType === ReviewType.COACH) where.coachId = targetId;
  if (reviewType === ReviewType.PROGRAM) where.schoolId = targetId;
  if (reviewType === ReviewType.UNIVERSITY) where.universityId = targetId;
  if (reviewType === ReviewType.DORM) where.dormId = targetId;
  if (reviewType === ReviewType.PARENT_INSIGHT) {
    where.OR = [{ coachId: targetId }, { schoolId: targetId }];
  }

  const reviews = await prisma.review.findMany({
    where,
    take: limit,
    orderBy: [{ weight: "desc" }, { helpfulCount: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { id: true, role: true, verificationStatus: true } },
    },
  });

  return NextResponse.json({ reviews });
}
