/**
 * POST /api/legal/accept
 *
 * Re-acceptance endpoint. Called by <LegalReacceptanceGate /> when a
 * signed-in user has stale `termsAcceptedVersion` /
 * `privacyAcceptedVersion` after a constant bump.
 *
 * Body shape mirrors the registration request:
 *   { acceptedTermsVersion, acceptedPrivacyVersion }
 *
 * Server compares against the canonical constants. On match, both
 * `<doc>AcceptedAt` timestamps refresh + an audit-log entry lands.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from "@/lib/legal-versions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";

const schema = z.object({
  acceptedTermsVersion: z.string().min(1).max(40),
  acceptedPrivacyVersion: z.string().min(1).max(40),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
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

  if (
    parsed.data.acceptedTermsVersion !== CURRENT_TERMS_VERSION ||
    parsed.data.acceptedPrivacyVersion !== CURRENT_PRIVACY_VERSION
  ) {
    return NextResponse.json(
      {
        error:
          "Our Terms of Service or Privacy Policy were updated. Please reload the page and try again.",
      },
      { status: 409 }
    );
  }

  const acceptedAt = new Date();
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      termsAcceptedAt: acceptedAt,
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
      privacyAcceptedAt: acceptedAt,
      privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
    },
  });

  await logAdminAction({
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.LEGAL_TERMS_ACCEPTED,
    targetType: "User",
    targetId: session.user.id,
    metadata: {
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: acceptedAt.toISOString(),
      source: "reacceptance",
    },
  });

  return NextResponse.json({ ok: true });
}
