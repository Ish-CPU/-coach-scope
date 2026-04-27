import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canParticipate, describeGate, getSession, whyCannotParticipate } from "@/lib/permissions";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = whyCannotParticipate(session);
  if (gate) {
    return NextResponse.json({ error: describeGate(gate) }, { status: 403 });
  }

  const userId = session!.user.id;
  const reviewId = params.id;

  try {
    await prisma.$transaction([
      prisma.helpfulVote.create({ data: { userId, reviewId } }),
      prisma.review.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
      }),
    ]);
  } catch {
    await prisma.$transaction([
      prisma.helpfulVote.deleteMany({ where: { userId, reviewId } }),
      prisma.review.update({
        where: { id: reviewId },
        data: { helpfulCount: { decrement: 1 } },
      }),
    ]);
    return NextResponse.json({ toggled: "off" });
  }

  return NextResponse.json({ toggled: "on" });
}
