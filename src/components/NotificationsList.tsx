"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { NotificationType } from "@prisma/client";

interface NotificationRow {
  id: string;
  type: NotificationType;
  subjectType: string | null;
  subjectId: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
}

const TYPE_LABEL: Record<NotificationType, string> = {
  REPLY_TO_POST: "replied to your post",
  REPLY_TO_COMMENT: "replied to your comment",
  POST_UPVOTE: "upvoted your post",
  MOD_ACTION: "took a moderator action",
  ADMIN_ACTION: "platform admin action",
  GROUP_INVITE: "invited you to a group",
  GROUP_APPROVAL: "approved your group request",
};

export function NotificationsList({
  initial,
}: {
  initial: NotificationRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();

  function actorName(n: NotificationRow): string {
    return n.actor?.name || n.actor?.email || "Someone";
  }

  // Resolve a deep link from the polymorphic subject. Most events route
  // back to a group post; admin actions are best left to the dashboard.
  function deepLink(n: NotificationRow): string {
    const groupSlug = (n.data?.groupSlug as string | undefined) ?? null;
    if (n.subjectType === "GroupPost" && groupSlug && n.subjectId) {
      return `/groups/${groupSlug}/posts/${n.subjectId}`;
    }
    if (n.subjectType === "Group" && groupSlug) {
      return `/groups/${groupSlug}`;
    }
    return "/dashboard";
  }

  async function markRead(id: string) {
    startTransition(async () => {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, read: true } : r))
      );
      router.refresh();
    });
  }

  async function markAll() {
    startTransition(async () => {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setRows((prev) => prev.map((r) => ({ ...r, read: true })));
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-500">
        No notifications yet — replies, mod actions, and upvotes will land here.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending || rows.every((r) => r.read)}
          onClick={markAll}
          className="text-xs font-medium text-brand-700 hover:underline disabled:text-slate-400"
        >
          Mark all read
        </button>
      </div>
      <div className="mt-2 card divide-y divide-slate-100">
        {rows.map((n) => {
          const title = (n.data?.title as string | undefined) ?? null;
          const groupName = (n.data?.groupName as string | undefined) ?? null;
          const actionLabel = (n.data?.actionLabel as string | undefined) ?? null;
          const verb =
            n.type === "MOD_ACTION" && actionLabel
              ? actionLabel
              : TYPE_LABEL[n.type];
          return (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-3 p-3 text-sm ${
                n.read ? "" : "bg-amber-50/40"
              }`}
            >
              <div className="min-w-0">
                <div className="text-slate-700">
                  <span className="font-medium">{actorName(n)}</span>{" "}
                  <span className="text-slate-600">{verb}</span>
                  {groupName && (
                    <span className="text-slate-500"> in {groupName}</span>
                  )}
                </div>
                {title && (
                  <Link
                    href={deepLink(n)}
                    onClick={() => !n.read && markRead(n.id)}
                    className="mt-0.5 line-clamp-1 text-[13px] text-brand-700 hover:underline"
                  >
                    {title}
                  </Link>
                )}
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              {!n.read && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markRead(n.id)}
                  className="whitespace-nowrap text-[11px] font-medium text-brand-700 hover:underline"
                >
                  Mark read
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
