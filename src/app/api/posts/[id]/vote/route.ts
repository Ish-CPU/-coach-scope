import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canParticipateInGroup,
  describeGate,
  getSession,
  whyCannotParticipate,
} from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";

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

  if (!canParticipateInGroup(session, post.group.groupType)) {
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
      if (!existing) return post;
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
      return post;
    }

    return tx.groupPost.update({
      where: { id: postId },
      data: {
        upvoteCount: { increment: upDelta },
        downvoteCount: { increment: downDelta },
        totalScore: { increment: upDelta - downDelta },
      },
    });
  });

  return NextResponse.json({
    upvoteCount: updated.upvoteCount,
    downvoteCount: updated.downvoteCount,
    totalScore: updated.totalScore,
    yourVote: newValue,
  });
}
