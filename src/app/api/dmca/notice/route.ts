/**
 * POST /api/dmca/notice
 *
 * Public DMCA intake — accepts BOTH takedown notices and counter-notices,
 * discriminated by the `kind` field in the body. Public (no sign-in)
 * because rightsholders generally don't have accounts and counter-noticers
 * may be filing on behalf of someone whose account is suspended.
 *
 * Validation mirrors 17 U.S.C. § 512(c)(3) (takedowns) and § 512(g)(3)
 * (counter-notices) — every statutorily required element is checked
 * before we accept the row. An incomplete notice is rejected with 400
 * so we never write a partial-and-therefore-invalid notice into the
 * audit log.
 *
 * On accept:
 *   - Capture submitter IP + user-agent on the row for traceability
 *   - Email admins (reports category) with a preview
 *   - Audit-log DMCA_NOTICE_SUBMITTED with the notice id
 *   - Counter-notices get `counterEligibleToRestoreAt = now + 14 days`
 *     so the admin queue shows when the statutory window closes
 *
 * Rate limit: 5 per hour per IP — generous for honest legal filings,
 * tight enough to block abuse / spam.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendDmcaNoticeEmail } from "@/lib/email/notifications";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { DmcaNoticeKind, DmcaNoticeStatus } from "@prisma/client";
import { clientIpFrom } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Common fields required regardless of kind.
const commonShape = {
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().min(10).max(500),
  signature: z.string().trim().min(2).max(120),
  perjuryStatement: z.literal(true, {
    errorMap: () => ({
      message: "You must agree to the statement under penalty of perjury.",
    }),
  }),
};

const takedownSchema = z.object({
  kind: z.literal("TAKEDOWN"),
  ...commonShape,
  copyrightedWork: z.string().trim().min(10).max(4000),
  infringingUrl: z.string().trim().url().max(500),
  goodFaithStatement: z.literal(true, {
    errorMap: () => ({
      message: "You must agree to the good-faith statement.",
    }),
  }),
});

const counterNoticeSchema = z.object({
  kind: z.literal("COUNTER_NOTICE"),
  ...commonShape,
  removedContentDescription: z.string().trim().min(10).max(4000),
  parentNoticeId: z.string().trim().max(50).optional(),
  consentToJurisdiction: z.literal(true, {
    errorMap: () => ({
      message:
        "You must consent to the jurisdiction of federal district court.",
    }),
  }),
  acceptServiceOfProcess: z.literal(true, {
    errorMap: () => ({
      message:
        "You must agree to accept service of process from the complaining party.",
    }),
  }),
});

const bodySchema = z.discriminatedUnion("kind", [
  takedownSchema,
  counterNoticeSchema,
]);

export async function POST(req: Request) {
  // 5 per hour per IP. Honest legal filings are infrequent; this slows
  // abuse without blocking a real rightsholder filing for multiple URLs.
  const limited = await rateLimit(req, "dmca:submit", {
    max: 5,
    windowMs: 60 * 60_000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Notice is incomplete or invalid.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Capture traceability metadata BEFORE writing. Same headers helper
  // the auth layer uses for rate limiting.
  const headers = req.headers;
  const submitterIp = clientIpFrom(headers);
  const submitterUserAgent = headers.get("user-agent")?.slice(0, 500) ?? null;

  const isTakedown = data.kind === "TAKEDOWN";

  // 14 days from now for counter-notices. § 512(g)(2)(C) requires 10-14
  // business days; we use 14 calendar days for simplicity + a wider
  // margin in the original sender's favor.
  const counterEligibleAt = isTakedown
    ? null
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const created = await prisma.dmcaNotice.create({
    data: {
      kind: data.kind === "TAKEDOWN" ? DmcaNoticeKind.TAKEDOWN : DmcaNoticeKind.COUNTER_NOTICE,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone ?? null,
      address: data.address,
      signature: data.signature,
      submitterIp,
      submitterUserAgent,
      // Discriminated payload — Zod has already narrowed `data`.
      copyrightedWork: isTakedown ? data.copyrightedWork : null,
      infringingUrl: isTakedown ? data.infringingUrl : null,
      removedContentDescription: isTakedown ? null : data.removedContentDescription,
      parentNoticeId: isTakedown ? null : data.parentNoticeId ?? null,
      goodFaithStatement: isTakedown ? data.goodFaithStatement : false,
      perjuryStatement: data.perjuryStatement,
      consentToJurisdiction: isTakedown ? false : data.consentToJurisdiction,
      acceptServiceOfProcess: isTakedown ? false : data.acceptServiceOfProcess,
      status: DmcaNoticeStatus.PENDING,
      counterEligibleToRestoreAt: counterEligibleAt,
    },
    select: { id: true, kind: true },
  });

  // Audit + email — fire-and-forget so a slow email provider doesn't
  // block the user-facing acknowledgement. The notice is already
  // persisted; these are decorations.
  void logAdminAction({
    actorUserId: null,
    action: AUDIT_ACTIONS.DMCA_NOTICE_SUBMITTED,
    targetType: "DmcaNotice",
    targetId: created.id,
    metadata: {
      kind: created.kind,
      submitterName: data.fullName,
      submitterEmail: data.email,
      submitterIp,
    },
  });

  void sendDmcaNoticeEmail({
    noticeId: created.id,
    kind: created.kind,
    submitterName: data.fullName,
    submitterEmail: data.email,
    summary: isTakedown
      ? `Infringing URL: ${data.infringingUrl}\nWork: ${data.copyrightedWork.slice(0, 300)}`
      : `Content removed: ${data.removedContentDescription.slice(0, 300)}`,
  });

  return NextResponse.json(
    { ok: true, id: created.id, kind: created.kind },
    { status: 201 }
  );
}
