import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { sendModerationAlertEmail } from "@/lib/email/notifications";

/**
 * POST /api/groups/[slug]/posts/[postId]/report
 *
 * Authenticated users can report a group post. Same shape as the
 * /api/reviews/[id]/report endpoint:
 *   { reason, details? }
 *
 * Side effects:
 *   - Creates a Report row tied to the post
 *   - Increments the post's reportCount via the Report relation count
 *     (existing pattern)
 *   - Fires the admin moderation email; flags `thresholdExceeded` if
 *     the post has crossed REPORT_THRESHOLD reports
 */
const schema = z.object({
  reason: z.string().min(3).max(120),
  details: z.string().max(2000).optional(),
});

const REPORT_THRESHOLD = 3;

export async function POST(
  req: Request,
  { params }: { params: { slug: string; postId: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to report." }, { status: 401 });
  }

  const limited = rateLimit(req, "group-post:report", {
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

  const post = await prisma.groupPost.findUnique({
    where: { id: params.postId },
    select: { id: true, group: { select: { slug: true } } },
  });
  if (!post || post.group.slug !== params.slug) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const report = await prisma.report.create({
    data: {
      reporterId: session.user.id,
      postId: post.id,
      reason: parsed.data.reason,
      details: parsed.data.details,
    },
    select: { id: true },
  });

  // Open-report count for this post — drives the threshold email.
  const totalReports = await prisma.report.count({
    where: { postId: post.id, status: "OPEN" },
  });

  void (async () => {
    const reporter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    await sendModerationAlertEmail({
      target: "group_post",
      targetId: post.id,
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
