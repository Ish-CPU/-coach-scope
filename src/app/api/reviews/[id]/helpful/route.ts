import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canParticipate, describeGate, getSession, whyCannotParticipate } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  const gate = whyCannotParticipate(session);
  if (gate) {
    return NextResponse.json({ error: describeGate(gate) }, { status: 403 });
  }

  const limited = await rateLimit(req, "review:helpful", {
    max: 60,
    windowMs: 60_000,
    identifier: session!.user.id,
  });
  if (limited) return limited;

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
    // Vote toggled off — review's helpfulCount changed, profile cards
    // showing this review want the fresh number. See src/lib/cache.ts.
    revalidateTag("reviews");
    return NextResponse.json({ toggled: "off" });
  }

  // Vote toggled on — same reason as above.
  revalidateTag("reviews");
  return NextResponse.json({ toggled: "on" });
}
