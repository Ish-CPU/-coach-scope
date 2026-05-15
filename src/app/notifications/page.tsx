import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { NotificationsList } from "@/components/NotificationsList";

export const dynamic = "force-dynamic";

/**
 * In-app notifications inbox. Server-renders the most recent 50 rows
 * and hands them to a client component that handles read-toggle.
 */
export default async function NotificationsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?callbackUrl=/notifications");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      subjectType: true,
      subjectId: true,
      data: true,
      read: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="mt-1 text-sm text-slate-600">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : "You're all caught up."}
            </p>
          </div>
          <Link href="/dashboard" className="btn-secondary">
            Back to dashboard
          </Link>
        </div>
        <div className="mt-6">
          <NotificationsList
            initial={notifications.map((n) => ({
              ...n,
              createdAt: n.createdAt.toISOString(),
              data: (n.data as Record<string, unknown> | null) ?? null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
