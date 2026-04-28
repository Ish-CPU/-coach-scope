import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isPaymentVerified } from "@/lib/permissions";
import { UserRole, VerificationMethod, VerificationStatus } from "@prisma/client";
import {
  MAX_VERIFICATION_ATTEMPTS_24H,
  parseEduEmail,
  recentAttemptCount,
  rosterUrlLooksOfficial,
} from "@/lib/verification";
import { rateLimit } from "@/lib/rate-limit";
import { isSafeHttpUrl } from "@/lib/safe-url";

const schema = z.object({
  method: z.nativeEnum(VerificationMethod),
  eduEmail: z.string().email().optional().or(z.literal("")),
  rosterUrl: z.string().url().optional().or(z.literal("")),
  proofUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const isAdmin = session.user.role === UserRole.ADMIN;
  if (!isPaymentVerified(session) && !isAdmin) {
    return NextResponse.json(
      { error: "An active subscription is required before verifying your role." },
      { status: 403 }
    );
  }

  // Burst protection in addition to the 24h attempt cap below.
  const limited = rateLimit(req, "verification:submit", {
    max: 10,
    windowMs: 10 * 60_000,
    identifier: session.user.id,
  });
  if (limited) return limited;

  // Anti-fake throttle
  const attempts = await recentAttemptCount(session.user.id);
  if (attempts >= MAX_VERIFICATION_ATTEMPTS_24H && !isAdmin) {
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const role = session.user.role;

  // Method-vs-role validation.
  if (role === UserRole.VERIFIED_STUDENT && data.method !== VerificationMethod.EDU_EMAIL) {
    return NextResponse.json(
      { error: "Students verify with their .edu email — use the email-code flow." },
      { status: 400 }
    );
  }
  if (role === UserRole.VERIFIED_PARENT && data.method !== VerificationMethod.PARENT_DOC && data.method !== VerificationMethod.EDU_EMAIL) {
    return NextResponse.json(
      { error: "Parents verify with email or a parent-of-athlete document." },
      { status: 400 }
    );
  }

  // Inline checks for athlete proof submissions.
  if (data.method === VerificationMethod.EDU_EMAIL && data.eduEmail) {
    const parsedEmail = parseEduEmail(data.eduEmail);
    if (!parsedEmail.ok) {
      return NextResponse.json({ error: parsedEmail.reason }, { status: 400 });
    }
  }
  if (data.method === VerificationMethod.ROSTER_LINK) {
    if (!data.rosterUrl || !rosterUrlLooksOfficial(data.rosterUrl)) {
      return NextResponse.json(
        { error: "Provide an official athletics roster URL (school .edu / official athletics site)." },
        { status: 400 }
      );
    }
  }
  if (
    (data.method === VerificationMethod.PROOF_UPLOAD || data.method === VerificationMethod.PARENT_DOC) &&
    data.proofUrl &&
    !isSafeHttpUrl(data.proofUrl)
  ) {
    return NextResponse.json(
      { error: "Proof URL must be a public http(s) link, not a shortener or Drive link." },
      { status: 400 }
    );
  }

  const isParentRequest = role === UserRole.VERIFIED_PARENT;

  // Block duplicate pending requests
  const existingPending = await prisma.verificationRequest.findFirst({
    where: { userId: session.user.id, status: VerificationStatus.PENDING },
  });
  if (existingPending) {
    return NextResponse.json({ error: "You already have a pending request." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.verificationRequest.create({
      data: {
        userId: session.user.id,
        targetRole: role,
        method: data.method,
        isParentRequest,
        eduEmail: data.eduEmail || null,
        rosterUrl: data.rosterUrl || null,
        proofUrl: data.proofUrl || null,
        notes: data.notes || null,
        status: VerificationStatus.PENDING,
        attemptNumber: attempts + 1,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { verificationStatus: VerificationStatus.PENDING },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    note:
      data.method === VerificationMethod.PROOF_UPLOAD
        ? "Manual proof submitted — admin review is required (uploads are never auto-approved)."
        : "Submitted for review.",
  });
}
