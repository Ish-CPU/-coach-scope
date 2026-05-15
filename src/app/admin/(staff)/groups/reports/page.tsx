import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { canModerateReviews } from "@/lib/admin-permissions";
import { GroupReportRow } from "@/components/admin/GroupReportRow";

export const dynamic = "force-dynamic";

/**
 * Group post + comment moderation queue. Reports against group posts /
 * comments live in the same `Report` table the existing review queue
 * uses; this page filters to rows with a `postId` or `commentId` set
 * and surfaces approve / remove actions.
 *
 * The admin's actions hit /api/admin/groups/reports/[id] which:
 *   - "remove"   → sets the post's status REMOVED + closes the report
 *   - "dismiss"  → closes the report without touching the content
 */
export default async function AdminGroupReportsPage() {
  const session = await getSession();
  if (!canModerateReviews(session)) redirect("/admin");

  const reports = await prisma.report.findMany({
    where: {
      status: "OPEN",
      OR: [{ postId: { not: null } }, { commentId: { not: null } }],
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      reason: true,
      details: true,
      createdAt: true,
      reporter: { select: { id: true, name: true, email: true } },
      post: {
        select: {
          id: true,
          title: true,
          status: true,
          group: { select: { slug: true, name: true } },
        },
      },
      comment: {
        select: {
          id: true,
          body: true,
          status: true,
          post: {
            select: {
              id: true,
              title: true,
              group: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Group reports
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {reports.length} open report{reports.length === 1 ? "" : "s"}.
              Action a row to remove the offending content or dismiss the
              report.
            </p>
          </div>
          <Link href="/admin/groups" className="btn-secondary">
            ← Back
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {reports.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-500">
              No open reports. Nice and quiet.
            </div>
          ) : (
            reports.map((r) => <GroupReportRow key={r.id} report={r} />)
          )}
        </div>
      </div>
    </div>
  );
}
