import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isPaymentVerified } from "@/lib/permissions";
import { UserRole } from "@prisma/client";
import {
  generateCode,
  hashCode,
  parseEduEmail,
  recentAttemptCount,
  MAX_VERIFICATION_ATTEMPTS_24H,
  sendVerificationEmail,
} from "@/lib/verification";

const schema = z.object({
  email: z.string().email(),
});

const CODE_TTL_MIN = 15;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!isPaymentVerified(session) && session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Subscribe before verifying your role." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const role = session.user.role;
  // Students must use a .edu address; parents may use any verified email.
  if (role === UserRole.VERIFIED_STUDENT) {
    const r = parseEduEmail(parsed.data.email);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
  }

  // Throttle.
  const attempts = await recentAttemptCount(session.user.id);
  if (attempts >= MAX_VERIFICATION_ATTEMPTS_24H && session.user.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please contact support." },
      { status: 429 }
    );
  }

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000);
  const purpose = role === UserRole.VERIFIED_PARENT ? "PARENT_EMAIL" : "STUDENT_EDU";

  // Invalidate any unused codes for the same purpose.
  await prisma.emailVerificationCode.updateMany({
    where: { userId: session.user.id, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.emailVerificationCode.create({
    data: {
      userId: session.user.id,
      email: parsed.data.email.trim().toLowerCase(),
      codeHash,
      purpose,
      expiresAt,
    },
  });

  await sendVerificationEmail({
    to: parsed.data.email,
    code,
    purpose,
  });

  return NextResponse.json({
    ok: true,
    expiresInMinutes: CODE_TTL_MIN,
    devCode: process.env.NODE_ENV === "production" ? undefined : code,
  });
}
