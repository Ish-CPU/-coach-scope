import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isPaymentVerified } from "@/lib/permissions";
import {
  UserRole,
  VerificationMethod,
  VerificationRequestStatus,
  VerificationStatus,
} from "@prisma/client";
import {
  parseEduEmail,
  recentAttemptCount,
  verifyCode,
  MAX_VERIFICATION_ATTEMPTS_24H,
} from "@/lib/verification";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!isPaymentVerified(session) && session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Subscribe before verifying your role." }, { status: 403 });
  }

  // Hard ceiling on code-confirm tries — slows brute-forcing the 6-digit code.
  const userLimited = rateLimit(req, "verification:code:confirm:user", {
    max: 10,
    windowMs: 15 * 60_000,
    identifier: session.user.id,
  });
  if (userLimited) return userLimited;
  const ipLimited = rateLimit(req, "verification:code:confirm:ip", {
    max: 30,
    windowMs: 15 * 60_000,
  });
  if (ipLimited) return ipLimited;

  const attempts = await recentAttemptCount(session.user.id);
  if (attempts >= MAX_VERIFICATION_ATTEMPTS_24H && session.user.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please contact support." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or code" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const role = session.user.role;
  const purpose = role === UserRole.VERIFIED_PARENT ? "PARENT_EMAIL" : "STUDENT_EDU";

  if (role === UserRole.VERIFIED_STUDENT) {
    const r = parseEduEmail(email);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
  }

  // Find the most recent unconsumed code for this user/email/purpose.
  const codeRow = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: session.user.id,
      email,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!codeRow) {
    return NextResponse.json({ error: "No active code for this email. Request a new one." }, { status: 400 });
  }

  const ok = await verifyCode(parsed.data.code, codeRow.codeHash);
  if (!ok) {
    // Log a rejected attempt for audit trail.
    await prisma.verificationRequest.create({
      data: {
        userId: session.user.id,
        targetRole: role,
        method: VerificationMethod.EDU_EMAIL,
        eduEmail: email,
        notes: "Code mismatch",
        status: VerificationStatus.REJECTED,
        attemptNumber: attempts + 1,
        isParentRequest: role === UserRole.VERIFIED_PARENT,
      },
    });
    return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
  }

  // Success: mark the code consumed, log the request as verified, promote the user.
  await prisma.$transaction([
    prisma.emailVerificationCode.update({
      where: { id: codeRow.id },
      data: { consumedAt: new Date() },
    }),
    prisma.verificationRequest.create({
      data: {
        userId: session.user.id,
        targetRole: role,
        method: VerificationMethod.EDU_EMAIL,
        eduEmail: email,
        // Email-code success path auto-approves the request — admin doesn't
        // need to look at this one. The user's verificationStatus also
        // jumps straight to VERIFIED via the user.update below.
        status: VerificationRequestStatus.APPROVED,
        schoolEmailVerified: true,
        confidenceScore: 100,
        reviewedAt: new Date(),
        attemptNumber: attempts + 1,
        isParentRequest: role === UserRole.VERIFIED_PARENT,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        verificationStatus: VerificationStatus.VERIFIED,
        emailVerified: new Date(),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
