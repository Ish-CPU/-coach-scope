import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";

const schema = z.object({
  reason: z.string().min(3).max(120),
  details: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to report." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.report.create({
      data: {
        reporterId: session.user.id,
        reviewId: params.id,
        reason: parsed.data.reason,
        details: parsed.data.details,
      },
    }),
    prisma.review.update({
      where: { id: params.id },
      data: { reportCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
