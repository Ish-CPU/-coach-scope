import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { ReportStatus, ReviewStatus } from "@prisma/client";

const schema = z.object({ action: z.enum(["hide", "remove", "dismiss"]) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.action === "dismiss") {
    await prisma.report.update({
      where: { id: report.id },
      data: { status: ReportStatus.DISMISSED, resolvedAt: new Date(), resolvedBy: session!.user.id },
    });
    return NextResponse.json({ ok: true });
  }

  const newReviewStatus = parsed.data.action === "remove" ? ReviewStatus.REMOVED : ReviewStatus.HIDDEN;
if (!report.reviewId) {
  return NextResponse.json(
    { error: "This report is not attached to a review." },
    { status: 400 }
  )
}
  await prisma.$transaction([
    prisma.review.update({ where: { id: report.reviewId }, data: { status: newReviewStatus } }),
    prisma.report.update({
      where: { id: report.id },
      data: { status: ReportStatus.RESOLVED, resolvedAt: new Date(), resolvedBy: session!.user.id },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
