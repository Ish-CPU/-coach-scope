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
      role: true,
      notificationPreferences: true,
    },
  });

  const out = new Set<string>();
  for (const a of admins) {
    if (!a.email) continue;
    if (a.role === UserRole.MASTER_ADMIN) {
      out.add(a.email.toLowerCase());
      continue;
    }
    if (isOptedIn(a.notificationPreferences, category)) {
      out.add(a.email.toLowerCase());
    }
  }

  // Belt-and-suspenders: include MASTER_ADMIN_EMAIL even if the row hasn't
  // been seeded yet. Useful for fresh deployments.
  const envMaster = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase();
  if (envMaster) out.add(envMaster);

  return Array.from(out);
}
