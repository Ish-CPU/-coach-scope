import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, isAdmin } from "@/lib/permissions";
import { isMasterAdmin } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Admin landing / dashboard. Replaces the old "5 mixed tiles" layout
 * that hid most queues.
 *
 * Two sections:
 *   1. "Needs attention" — every queue with >0 items, ordered by
 *      urgency. DMCA shows up first because of the 24-48 hour
 *      statutory deadline; verifications and reports follow; the
 *      rest are listed alphabetically. Nothing pending → a single
 *      "all caught up" tile (so the section isn't empty / confusing).
 *   2. "At a glance" — total reviews / users (informational only).
 *
 * Queue counts MUST match the AdminNav badges (same Prisma queries)
 * so the dashboard and the per-page nav agree. Inconsistency was the
 * exact bug that caused "Open reports = 0 but DMCA badge shows (1)"
 * — the old dashboard read from the Report table only, missing every
 * other queue.
 */
export default async function AdminHomePage() {
  const session = await getSession();
  if (!isAdmin(session)) redirect("/");
  const master = isMasterAdmin(session);

  const [
    pendingVerifications,
    pendingAthleteConnections,
    pendingStudentConnections,
    pendingProgramRequests,
    openReports,
    pendingReviewModeration,
    pendingRoleChanges,
    pendingDmcaNotices,
    totalReviews,
    totalUsers,
  ] = await Promise.all([
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
    prisma.athleteProgramConnection.count({ where: { status: "PENDING" } }),
    prisma.studentUniversityConnection.count({ where: { status: "PENDING" } }),
    prisma.programRequest.count({ where: { status: "PENDING" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.review.count({
      where: { moderationStatus: { in: ["PENDING_REVIEW", "FLAGGED"] } },
    }),
    prisma.roleChangeRequest.count({ where: { status: "PENDING" } }),
    prisma.dmcaNotice.count({
      where: { status: { in: ["PENDING", "COUNTER_RECEIVED"] } },
    }),
    prisma.review.count(),
    prisma.user.count(),
  ]);

  // Build the "needs attention" list. DMCA is hard-pinned first when
  // present because of the statutory deadline — a 24-hour delay on
  // a DMCA takedown is materially worse than a 24-hour delay on a
  // pending program-request approval. The `urgent` flag drives a red
  // border so a fresh DMCA notice is visually distinct from a
  // routine moderation queue item.
  interface QueueItem {
    label: string;
    value: number;
    href: string;
    masterOnly?: boolean;
    urgent?: boolean;
    /** Subtitle rendered under the label, used for SLA hints. */
    hint?: string;
  }
  const allQueues: QueueItem[] = [
    {
      label: "DMCA notices",
      value: pendingDmcaNotices,
      href: "/admin/dmca",
      masterOnly: true,
      urgent: true,
      hint: "24–48h response window — act fast",
    },
    {
      label: "Pending verifications",
      value: pendingVerifications,
      href: "/admin/verifications",
    },
    { label: "Open reports", value: openReports, href: "/admin/reports" },
    {
      label: "Review moderation",
      value: pendingReviewModeration,
      href: "/admin/reviews",
    },
    {
      label: "Role change requests",
      value: pendingRoleChanges,
      href: "/admin/role-changes",
    },
    {
      label: "Athlete connections",
      value: pendingAthleteConnections,
      href: "/admin/connections",
    },
    {
      label: "Student connections",
      value: pendingStudentConnections,
      href: "/admin/connections",
    },
    {
      label: "School / program requests",
      value: pendingProgramRequests,
      href: "/admin/requests",
    },
  ];

  // Filter: only non-zero queues + roles the user actually has access to.
  const needsAttention = allQueues.filter(
    (q) => q.value > 0 && (!q.masterOnly || master)
  );
  const totalPending = needsAttention.reduce((s, q) => s + q.value, 0);

  return (
    <div className="container-page py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="mt-1 text-sm text-slate-600">
            Moderation, verification approvals, and public-data imports.
          </p>
        </div>
        {totalPending > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            {totalPending} item{totalPending === 1 ? "" : "s"} need attention
          </span>
        )}
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Needs attention
        </h2>
        {needsAttention.length === 0 ? (
          <div className="mt-2 card p-5 text-sm text-emerald-800 border-emerald-200 bg-emerald-50">
            ✓ All caught up — every queue is empty.
          </div>
        ) : (
          <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {needsAttention.map((q) => (
              <QueueTile key={q.label} item={q} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          At a glance
        </h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Stat label="Total reviews" value={totalReviews} />
          <Stat label="Total users" value={totalUsers} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Quick actions
        </h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Link href="/admin/members" className="card p-5 hover:shadow-card transition">
            <div className="text-xs uppercase tracking-wider text-slate-500">Members</div>
            <div className="mt-2 text-base font-semibold">View users + paying customers →</div>
            <p className="mt-1 text-xs text-slate-500">
              Search, filter by role/verification/subscription, manually mark verified.
            </p>
          </Link>
          <Link href="/admin/import" className="card p-5 hover:shadow-card transition">
            <div className="text-xs uppercase tracking-wider text-slate-500">Public-data import</div>
            <div className="mt-2 text-base font-semibold">Upload CSV →</div>
            <p className="mt-1 text-xs text-slate-500">
              Universities, programs, coaches, dorms, dining, athletic facilities.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Tile rendering a single non-zero pending queue. Urgent items get a
 *  red border + subtle background so DMCA stands out at a glance. */
function QueueTile({
  item,
}: {
  item: {
    label: string;
    value: number;
    href: string;
    urgent?: boolean;
    hint?: string;
  };
}) {
  return (
    <Link
      href={item.href}
      className={`card p-5 hover:shadow-card transition ${
        item.urgent ? "border-red-300 bg-red-50" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          {item.label}
        </div>
        {item.urgent && (
          <span className="inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Urgent
          </span>
        )}
      </div>
      <div className="mt-2 text-3xl font-bold">{item.value}</div>
      {item.hint && (
        <p className={`mt-1 text-xs ${item.urgent ? "text-red-700" : "text-slate-500"}`}>
          {item.hint}
        </p>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
