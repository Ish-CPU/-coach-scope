"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  createdAt: string | Date;
  reporter: { id: string; name: string | null; email: string };
  post: {
    id: string;
    title: string;
    status: string;
    group: { slug: string; name: string };
  } | null;
  comment: {
    id: string;
    body: string;
    status: string;
    post: {
      id: string;
      title: string;
      group: { slug: string; name: string };
    };
  } | null;
}

/**
 * Single moderation queue row. Two actions:
 *   - Remove: sets the underlying post / comment status REMOVED and
 *     resolves the report.
 *   - Dismiss: resolves the report without touching the content (the
 *     report was bogus / already handled).
 *
 * Optimistic UI: we fade the row out on success rather than re-fetch
 * the page. Use the in-place "Refresh queue" link if you want to
 * confirm the close.
 */
export function GroupReportRow({ report }: { report: ReportRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComment = !!report.comment;
  const target = report.comment ?? report.post!;
  const groupInfo = report.comment
    ? report.comment.post.group
    : report.post!.group;
  const targetTitle = report.comment
    ? `(comment on) ${report.comment.post.title}`
    : report.post!.title;
  const targetHref = report.comment
    ? `/groups/${groupInfo.slug}/posts/${report.comment.post.id}#comment-${report.comment.id}`
    : `/groups/${groupInfo.slug}/posts/${report.post!.id}`;

  async function action(verb: "remove" | "dismiss") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/groups/reports/${report.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: verb }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Action failed.");
      return;
    }
    setResolved(true);
    router.refresh();
  }

  if (resolved) {
    return (
      <div className="card p-4 text-xs text-emerald-800">
        Resolved. <Link href="/admin/groups/reports" className="underline">Refresh queue</Link>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-slate-500">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {isComment ? "Comment" : "Post"} reported
          </div>
          <div className="mt-0.5">
            in{" "}
            <Link
              href={`/groups/${groupInfo.slug}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {groupInfo.name}
            </Link>
            {" · "}
            {new Date(report.createdAt).toLocaleString()}
            {" · "}
            reported by {report.reporter.name || report.reporter.email}
          </div>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
          {target.status.toLowerCase()}
        </span>
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
        <Link
          href={targetHref}
          className="line-clamp-1 font-medium text-slate-900 hover:underline"
        >
          {targetTitle}
        </Link>
        {report.comment && (
          <p className="mt-1 line-clamp-3 text-xs text-slate-600">
            {report.comment.body}
          </p>
        )}
      </div>

      <div className="mt-3 text-xs">
        <div>
          <span className="font-medium text-slate-700">Reason:</span>{" "}
          {report.reason}
        </div>
        {report.details && (
          <div className="mt-1 text-slate-600">
            <span className="font-medium text-slate-700">Details:</span>{" "}
            {report.details}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => action("dismiss")}
          className="btn-secondary text-xs"
        >
          Dismiss report
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => action("remove")}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Remove content
        </button>
      </div>
    </div>
  );
}
