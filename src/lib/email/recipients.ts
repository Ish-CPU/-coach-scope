import { prisma } from "@/lib/prisma";
import { AdminStatus, UserRole } from "@prisma/client";

/**
 * Categorical buckets the notification system understands. Used as keys
 * inside `User.notificationPreferences` JSON.
 *
 * MASTER_ADMIN ignores this map and always receives every category — it's
 * the canonical owner contact for the deployment.
 */
export const NOTIFICATION_CATEGORIES = [
  "verifications",
  "connections",
  "reports",
  "program_requests",
  "admin_lifecycle",
  "security",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

interface PreferencesShape {
  // partial — undefined keys default to true (opt-in by default).
  [k: string]: boolean | undefined;
}

function isOptedIn(raw: unknown, category: NotificationCategory): boolean {
  if (!raw || typeof raw !== "object") return true;
  const prefs = raw as PreferencesShape;
  // Explicit false opts out; undefined / true keeps the default subscription.
  return prefs[category] !== false;
}

/**
 * Resolve the unique set of recipient email addresses for a given
 * notification category. Includes:
 *   - every MASTER_ADMIN (always)
 *   - every ACTIVE staff ADMIN whose preferences don't opt out of `category`
 *
 * The optional `MASTER_ADMIN_EMAIL` env var is folded in too so the
 * deployment owner gets a copy even before a row exists in `User`. The
 * primary loop is one Prisma query so this stays cheap for hot paths.
 */
export async function getAdminNotificationRecipients(
  category: NotificationCategory
): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      OR: [
        { role: UserRole.MASTER_ADMIN },
        {
          role: UserRole.ADMIN,
          adminStatus: AdminStatus.ACTIVE,
        },
      ],
    },
    select: {
      email: true,
      // workEmail is a separate notification destination — see the
      // resolveRecipientEmail comment below. Used to route admin alerts
      // to a business address (e.g. customersupport@yourdomain.com)
      // while keeping the personal address as the sign-in credential.
      workEmail: true,
      role: true,
      notificationPreferences: true,
    },
  });

  // For each admin, prefer workEmail when set; otherwise fall back to
  // their primary login email. Lets a master admin keep ibjratemyu@gmail.com
  // as their sign-in but route every admin alert to a separate inbox
  // like customersupport@myuniversityverified.com — without losing
  // the ability to sign in with the personal address.
  function resolveRecipientEmail(a: { email: string; workEmail: string | null }): string | null {
    const trimmedWork = a.workEmail?.trim();
    if (trimmedWork) return trimmedWork.toLowerCase();
    if (a.email) return a.email.toLowerCase();
    return null;
  }

  const out = new Set<string>();
  for (const a of admins) {
    const target = resolveRecipientEmail(a);
    if (!target) continue;
    if (a.role === UserRole.MASTER_ADMIN) {
      out.add(target);
      continue;
    }
    if (isOptedIn(a.notificationPreferences, category)) {
      out.add(target);
    }
  }

  // Belt-and-suspenders: include MASTER_ADMIN_EMAIL even if the row hasn't
  // been seeded yet. Useful for fresh deployments.
  const envMaster = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase();
  if (envMaster) out.add(envMaster);

  return Array.from(out);
}
