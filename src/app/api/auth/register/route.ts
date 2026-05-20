import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { PASSWORD_BCRYPT_ROUNDS } from "@/lib/security";
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from "@/lib/legal-versions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  // Required legal-consent version strings. The client sources these
  // from src/lib/legal-versions.ts; we compare them against the same
  // constants server-side. Any mismatch (stale client, missing field,
  // tampered request) is rejected.
  acceptedTermsVersion: z.string().min(1).max(40),
  acceptedPrivacyVersion: z.string().min(1).max(40),
});

/**
 * Sign up creates a free VIEWER account. The user picks their participation
 * role (Athlete / Student / Parent) on /onboarding.
 *
 * Legal acceptance is REQUIRED at sign-up. We persist both the timestamp
 * and the exact version string so audit history is traceable. Bumping
 * CURRENT_TERMS_VERSION or CURRENT_PRIVACY_VERSION in
 * src/lib/legal-versions.ts forces existing users through the
 * re-acceptance flow on next sign-in (see src/components/legal/...).
 */
export async function POST(req: Request) {
  // 5 sign-ups per 5 minutes per IP — slows enumeration + bot floods.
  const limited = await rateLimit(req, "auth:register", { max: 5, windowMs: 5 * 60_000 });
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
  const {
    name,
    email,
    password,
    acceptedTermsVersion,
    acceptedPrivacyVersion,
  } = parsed.data;

  // Reject stale client / tampered requests. Returning a generic message
  // avoids hinting at the exact mismatch.
  if (
    acceptedTermsVersion !== CURRENT_TERMS_VERSION ||
    acceptedPrivacyVersion !== CURRENT_PRIVACY_VERSION
  ) {
    return NextResponse.json(
      {
        error:
          "Our Terms of Service or Privacy Policy were updated. Please reload the page and try again.",
      },
      { status: 409 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS);
  const acceptedAt = new Date();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      termsAcceptedAt: acceptedAt,
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
      privacyAcceptedAt: acceptedAt,
      privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
    },
  });

  // Compliance evidence: log the acceptance so we can prove later that
  // this user agreed to these specific versions. Uses the existing
  // admin audit-log table; "actor" is the user themselves.
  await logAdminAction({
    actorUserId: user.id,
    action: AUDIT_ACTIONS.LEGAL_TERMS_ACCEPTED,
    targetType: "User",
    targetId: user.id,
    metadata: {
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: acceptedAt.toISOString(),
      source: "signup",
    },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
