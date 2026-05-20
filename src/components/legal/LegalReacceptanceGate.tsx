/**
 * Server-side gate that injects a blocking re-acceptance modal when the
 * signed-in user's stored TOS/Privacy version is stale.
 *
 * USAGE
 *   Drop <LegalReacceptanceGate /> once near the top of your
 *   root layout (src/app/layout.tsx). It quietly renders nothing for
 *   logged-out users and for users whose versions are current; otherwise
 *   it overlays a modal that blocks the entire page until they accept.
 *
 * WHY A SERVER COMPONENT
 *   - The DB read happens on the server, so we don't ship the user's
 *     version strings to the client unnecessarily.
 *   - The modal renders into the body via a fixed-position overlay
 *     even though the surrounding page tree is server-rendered.
 *   - The "Accept" interaction is wrapped in a small client component
 *     (LegalReacceptanceClient) which POSTs to /api/legal/accept.
 */
import { getSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  termsAreCurrent,
  privacyIsCurrent,
} from "@/lib/legal-versions";
import { LegalReacceptanceClient } from "./LegalReacceptanceClient";

export async function LegalReacceptanceGate() {
  const session = await getSession();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      termsAcceptedVersion: true,
      privacyAcceptedVersion: true,
    },
  });
  if (!user) return null;

  const termsOk = termsAreCurrent(user.termsAcceptedVersion);
  const privacyOk = privacyIsCurrent(user.privacyAcceptedVersion);
  if (termsOk && privacyOk) return null;

  return (
    <LegalReacceptanceClient
      currentTermsVersion={CURRENT_TERMS_VERSION}
      currentPrivacyVersion={CURRENT_PRIVACY_VERSION}
      // Surface which doc(s) need re-acceptance so the modal can show
      // accurate "Terms were updated" vs. "Terms AND Privacy were
      // updated" copy.
      needsTerms={!termsOk}
      needsPrivacy={!privacyOk}
    />
  );
}
