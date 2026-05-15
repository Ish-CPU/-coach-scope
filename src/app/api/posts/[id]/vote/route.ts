import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canPostInGroup,
  describeGate,
  getSession,
  whyCannotParticipate,
} from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications-inapp";
import { NotificationType } from "@prisma/client";

const schema = z.object({
  // value of 0 removes the vote; +1 upvotes; -1 downvotes
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = whyCannotParticipate(session);
  if (gate) {
    return NextResponse.json({ error: describeGate(gate) }, { status: 403 });
  }

  // High burst budget — votes are tiny but spammable; 120/min still feels instant.
  const limited = rateLimit(req, "post:vote", {
    max: 120,
    windowMs: 60_000,
    identifier: session!.user.id,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const userId = session!.user.id;
  const postId = params.id;
  const newValue = parsed.data.value;

  const post = await prisma.groupPost.findUnique({
    where: { id: postId },
    include: { group: true },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId, groupId: post.groupId } },
    select: { id: true },
  });
  if (
    !canPostInGroup(session, {
      groupType: post.group.groupType,
      visibility: post.group.visibility,
      isMember: !!membership,
    })
  ) {
    return NextResponse.json(
      { error: describeGate("wrong-role", { groupType: post.group.groupType }) },
      { status: 403 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.groupPostVote.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    let upDelta = 0;
    let downDelta = 0;

    if (newValue === 0) {
      // Toggle off — only do work if there's a vote to remove. Either
      // way return the unchanged post + zero delta so the outer code
      // sees a consistent shape.
      if (!existing) return { post, upDelta: 0 };
      if (existing.value === 1) upDelta = -1;
      else downDelta = -1;
      await tx.groupPostVote.delete({ where: { id: existing.id } });
    } else if (!existing) {
      if (newValue === 1) upDelta = 1;
      else downDelta = 1;
      await tx.groupPostVote.create({
        data: { userId, postId, value: newValue },
      });
    } else if (existing.value !== newValue) {
      if (newValue === 1) {
        upDelta = 1;
        downDelta = -1;
      } else {
        upDelta = -1;
        downDelta = 1;
      }
      await tx.groupPostVote.update({
        where: { id: existing.id },
        data: { value: newValue },
      });
    } else {
      // Same vote re-cast — no-op.
      return { post, upDelta: 0 };
    }

    // Bump the post author's cached `trustScore` so it tracks community
    // signal in real time. We move score by the same amount the post's
    // totalScore moved (`upDelta - downDelta`), capped per-vote so a
    // single vote can't swing the meter wildly. No-op when delta is 0.
    const trustDelta = upDelta - downDelta;
    if (trustDelta !== 0) {
      await tx.user.update({
        where: { id: post.authorId },
        data: { trustScore: { increment: trustDelta } },
      });
    }

    return {
      post: await tx.groupPost.update({
        where: { id: postId },
        data: {
          upvoteCount: { increment: upDelta },
          downvoteCount: { increment: downDelta },
          totalScore: { increment: upDelta - downDelta },
        },
      }),
      upDelta,
    };
  });

  // Notify the post author when this vote NET ADDED an upvote (moving
  // 0→+1 or -1→+1). Avoids spamming on toggle-off and on downvotes
  // (downvotes are intentionally silent — surfacing them would feel
  // adversarial). Self-vote is short-circuited inside createNotification.
  if (updated.upDelta > 0) {
    void createNotification({
      userId: post.authorId,
      actorId: userId,
      type: NotificationType.POST_UPVOTE,
      subjectType: "GroupPost",
      subjectId: postId,
      data: {
        title: post.title,
        groupSlug: post.group.slug,
        groupName: post.group.name,
        totalScore: updated.post.totalScore,
      },
    });
  }

  return NextResponse.json({
    upvoteCount: updated.post.upvoteCount,
    downvoteCount: updated.post.downvoteCount,
    totalScore: updated.post.totalScore,
    yourVote: newValue,
  });
}
