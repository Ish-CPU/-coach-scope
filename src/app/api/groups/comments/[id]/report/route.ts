import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { sendModerationAlertEmail } from "@/lib/email/notifications";

const schema = z.object({
  reason: z.string().min(3).max(120),
  details: z.string().max(2000).optional(),
});

const REPORT_THRESHOLD = 3;

/**
 * POST /api/groups/comments/[id]/report
 *
 * Authenticated users can report a group comment. Mirrors the post
 * report endpoint exactly. Path is intentionally /api/groups/comments
 * (not /api/groups/[slug]/posts/[postId]/comments/[id]/report) — a
 * comment id is globally unique so we don't need the slug or post id
 * in the route.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to report." }, { status: 401 });
  }

  const limited = rateLimit(req, "group-comment:report", {
    max: 20,
    windowMs: 10 * 60_000,
    identifier: session.user.id,
  });
  if (limited) return limited;

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

  const comment = await prisma.groupComment.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const report = await prisma.report.create({
    data: {
      reporterId: session.user.id,
      commentId: comment.id,
      reason: parsed.data.reason,
      details: parsed.data.details,
    },
    select: { id: true },
  });

  const totalReports = await prisma.report.count({
    where: { commentId: comment.id, status: "OPEN" },
  });

  void (async () => {
    const reporter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    await sendModerationAlertEmail({
      target: "group_comment",
      targetId: comment.id,
      reportId: report.id,
      reason: parsed.data.reason,
      totalReports,
      reporterName: reporter?.name ?? null,
      reporterEmail: reporter?.email ?? null,
      thresholdExceeded: totalReports >= REPORT_THRESHOLD,
    });
  })();

  return NextResponse.json({ ok: true });
}
