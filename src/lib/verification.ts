import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { VERIFICATION_CODE_BCRYPT_ROUNDS } from "@/lib/security";
import { isSafeHttpUrl } from "@/lib/safe-url";

/**
 * Anti-fake limit: at most this many verification attempts per user
 * within the rolling 24h window.
 */
export const MAX_VERIFICATION_ATTEMPTS_24H = 5;

export async function recentAttemptCount(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.verificationRequest.count({
    where: { userId, createdAt: { gte: since } },
  });
}

/**
 * Validate a .edu address; reject obvious typos and return the lowercased domain.
 */
export function parseEduEmail(email: string):
  | { ok: true; domain: string; normalized: string }
  | { ok: false; reason: string } {
  const trimmed = email.trim().toLowerCase();
  const m = /^[^\s@]+@([a-z0-9.-]+\.edu)$/.exec(trimmed);
  if (!m) {
    return { ok: false, reason: "Use a valid .edu email." };
  }
  return { ok: true, normalized: trimmed, domain: m[1] };
}

export function rosterUrlLooksOfficial(rosterUrl: string): boolean {
  if (!isSafeHttpUrl(rosterUrl)) return false;
  try {
    const u = new URL(rosterUrl);
    const host = u.hostname.toLowerCase();
    // Heuristic: official athletics sites typically end in .edu, .com (gostanford.com),
    // or .org. Shorteners + Drive are already blocked by isSafeHttpUrl.
    return /\.(edu|com|org|net|gov)$/.test(host);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// One-time code helpers
// ---------------------------------------------------------------------------

/** Six-digit numeric code as a zero-padded string. */
export function generateCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, VERIFICATION_CODE_BCRYPT_ROUNDS);
}

export async function verifyCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * In production, swap this for Resend / SendGrid / Postmark.
 * In dev, we log so a developer can read the code from the server console.
 *
 * IMPORTANT: in production we MUST NOT log the code itself — it's a one-time
 * authentication factor. We only log the purpose + recipient.
 */
export async function sendVerificationEmail(opts: {
  to: string;
  code: string;
  purpose: string;
}): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    // Hook for a real email provider here:
    //   await resend.emails.send({ from, to, subject, html });
    // For now, log only metadata — never the code in prod.
    // eslint-disable-next-line no-console
    console.log(`[verification] purpose=${opts.purpose} sent to=${opts.to}`);
    return;
  }
  // Dev only — surface the code to the local terminal for testing.
  // eslint-disable-next-line no-console
  console.log(
    `[verification] purpose=${opts.purpose} → ${opts.to} :: code=${opts.code} (this would be emailed in prod)`
  );
}
