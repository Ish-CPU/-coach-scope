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

// Threshold at which a review crossing it triggers a louder "exceeded
// moderation threshold" alert (in addition to the per-report email).
// Tunable; chosen low intentionally so brigading is caught quickly.
const REPORT_THRESHOLD = 3;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to report." }, { status: 401 });
  }

  // Reports can be brigaded — cap at 20 / 10min per reporter.
  const limited = rateLimit(req, "review:report", {
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

  const [report, updatedReview] = await prisma.$transaction([
    prisma.report.create({
      data: {
        reporterId: session.user.id,
        reviewId: params.id,
        reason: parsed.data.reason,
        details: parsed.data.details,
      },
      select: { id: true },
    }),
    prisma.review.update({
      where: { id: params.id },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true },
    }),
  ]);

  // Notify admins. The user response shouldn't wait for SMTP latency, so
  // fire-and-forget. The threshold-exceeded variant uses a different
  // subject so admins can prioritize at a glance.
  void (async () => {
    const reporter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    await sendModerationAlertEmail({
      target: "review",
      targetId: params.id,
      reportId: report.id,
      reason: parsed.data.reason,
      totalReports: updatedReview.reportCount,
      reporterName: reporter?.name ?? null,
      reporterEmail: reporter?.email ?? null,
      thresholdExceeded: updatedReview.reportCount >= REPORT_THRESHOLD,
    });
  })();

  return NextResponse.json({ ok: true });
}
