import { prisma } from "@/lib/prisma";

/**
 * Force-logout for a given user. Two layers:
 *
 *   1. `User.sessionsRevokedAt = now` — every JWT issued before this
 *      timestamp is treated as signed-out on the next request by the
 *      `jwt` callback in src/lib/auth.ts.
 *
 *   2. Delete every NextAuth `Session` row for the user — covers the case
 *      where the PrismaAdapter is also tracking DB sessions (it does for
 *      OAuth providers even when JWT is the strategy).
 *
 * Safe to call from any admin action — never throws on Session deletion
 * failure (the JWT layer alone is sufficient for credentials sign-in).
 */
export async function revokeUserSessions(userId: string): Promise<void> {
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { sessionsRevokedAt: now },
  });
  try {
    await prisma.session.deleteMany({ where: { userId } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[session-revoke] failed to delete Session rows for", userId, err);
  }
}
