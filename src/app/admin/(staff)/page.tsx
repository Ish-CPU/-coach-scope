import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import {
  canViewAuditLogs,
  isMasterAdmin,
} from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";

/**
 * Admin dashboard. Layout-level guard at src/app/admin/layout.tsx already
 * blocks non-admins, so this page can focus on data.
 *
 * Master-only widgets (recent admin activity) only render when the viewer
 * has audit-log permission. Staff admins still see queues + quick links.
 */
export default async function AdminHomePage() {
  const session = await getSession();
  const showActivity = canViewAuditLogs(session);
  const showTeam = isMasterAdmin(session);

  const [
    openReports,
    pendingVerifications,
    pendingProgramRequests,
    pendingAthleteConnections,
    pendingStudentConnections,
    pendingReviewModeration,
    totalReviews,
    totalUsers,
    totalAdmins,
    recentActivity,
  ] = await Promise.all([
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.verificationRequest.count({
      where: {
        status: {
          in: [
            "PENDING",
            "HIGH_CONFIDENCE",
            "NEEDS_REVIEW",
            "LOW_CONFIDENCE",
            "NEEDS_MORE_INFO",
          ],
        },
      },
    }),
    prisma.programRequest.count({ where: { status: "PENDING" } }),
    prisma.athleteProgramConnection.count({ where: { status: "PENDING" } }),
    prisma.studentUniversityConnection.count({ where: { status: "PENDING" } }),
    // PENDING_REVIEW + FLAGGED reviews waiting on a human decision. Mirrors
    // the badge logic in the admin nav so the dashboard tile and nav badge
    // never disagree.
    prisma.review.count({
      where: { moderationStatus: { in: ["PENDING_REVIEW", "FLAGGED"] } },
    }),
    prisma.review.count(),
    prisma.user.count(),
    showTeam
      ? prisma.user.count({ where: { role: { in: ["ADMIN", "MASTER_ADMIN"] } } })
      : Promise.resolve(0),
    showActivity
      ? prisma.adminActionLog.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { name: true, email: true } } },
        })
      : Promise.resolve([] as any[]),
  ]);

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
      <p className="mt-1 text-sm text-slate-600">
        Verification approvals, connection approvals, public-data imports, and moderation.
      </p>

      {/* --- Pending queues — what admins actually action --- */}
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Pending queues
      </h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Verifications"
          value={pendingVerifications}
          href="/admin/verifications"
          highlight={pendingVerifications > 0}
        />
        <Stat
          label="Athlete connections"
          value={pendingAthleteConnections}
          href="/admin/connections?kind=athlete"
          highlight={pendingAthleteConnections > 0}
        />
        <Stat
          label="Student connections"
          value={pendingStudentConnections}
          href="/admin/connections?kind=student"
          highlight={pendingStudentConnections > 0}
        />
        <Stat
          label="Review moderation"
          value={pendingReviewModeration}
          href="/admin/reviews"
          highlight={pendingReviewModeration > 0}
        />
        <Stat
          label="Open reports"
          value={openReports}
          href="/admin/reports"
          highlight={openReports > 0}
        />
      </div>

      {/* --- Stats — informational only --- */}
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Activity
      </h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="School / program requests"
          value={pendingProgramRequests}
          href="/admin/requests"
        />
        <Stat label="Total reviews" value={totalReviews} />
        <Stat label="Total users" value={totalUsers} />
      </div>

      {/* --- Operational tools / quick links --- */}
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Tools
      </h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/imports" className="card p-5 transition hover:shadow-card">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Public-data import
          </div>
          <div className="mt-2 text-base font-semibold">Upload CSV →</div>
          <p className="mt-1 text-xs text-slate-500">
            Universities, programs, coaches, dorms, dining, athletic facilities.
          </p>
        </Link>
        {showTeam && (
          <Link href="/admin/team" className="card p-5 transition hover:shadow-card">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Admin team
            </div>
            <div className="mt-2 text-base font-semibold">
              {totalAdmins} admin{totalAdmins === 1 ? "" : "s"} →
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Invite staff admins, edit permissions, disable accounts.
            </p>
          </Link>
        )}
        {showTeam && (
          <Link href="/admin/settings" className="card p-5 transition hover:shadow-card">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Owner settings
            </div>
            <div className="mt-2 text-base font-semibold">Recovery & 2FA →</div>
            <p className="mt-1 text-xs text-slate-500">
              Recovery emails, account safety, master-admin only controls.
            </p>
          </Link>
        )}
      </div>

      {/* --- Recent admin activity (audit log) --- */}
      {showActivity && (
        <>
          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent admin activity
          </h2>
          <div className="mt-2 card divide-y divide-slate-100">
            {recentActivity.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">No admin activity yet.</div>
            ) : (
              recentActivity.map((row: any) => (
                <div key={row.id} className="flex items-start justify-between gap-3 p-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-slate-700">{row.action}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {row.actor?.name || row.actor?.email || "system"}
                      {row.targetType ? ` · ${row.targetType}:${row.targetId ?? "?"}` : ""}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-slate-400">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  highlight = false,
}: {
  label: string;
  value: number;
  href?: string;
  highlight?: boolean;
}) {
  const inner = (
    <div
      className={`card p-5 transition hover:shadow-card ${
        highlight ? "ring-2 ring-amber-300" : ""
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${highlight ? "text-amber-700" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
