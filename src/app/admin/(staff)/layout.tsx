import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import { hasAnyAdminPermission, isMasterAdmin, isAnyAdmin } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminStatus } from "@prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Layout for every /admin/* route. Three responsibilities:
 *   1. Server-side admin guard. Non-admins get bounced to "/".
 *      Per-page guards still call admin helpers defensively in case this
 *      layout is ever bypassed by a middleware change.
 *   2. Force every newly-invited admin through /admin/onboarding before they
 *      can land on real admin pages — set their password, accept the rules.
 *   3. Render the shared admin nav with live pending-count badges and a
 *      master-only Team / Settings group.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!isAnyAdmin(session)) redirect("/");

  // Onboarding gate. Every admin — staff and master — must accept the
  // rules once before they can use the portal. The seed script flips
  // `onboardingCompleted` true for the master admin so the typical
  // deployment never hits this redirect, but if a master is promoted via
  // a different path they'll see the welcome page exactly once and can
  // click through.
  //
  // We treat either signal as "done" so legacy rows that have a
  // non-null `acceptedAdminRulesAt` from the older flow keep working
  // even if the boolean was never backfilled.
  const me = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      adminStatus: true,
      acceptedAdminRulesAt: true,
      onboardingCompleted: true,
    },
  });

  const onboarded =
    me?.onboardingCompleted === true || !!me?.acceptedAdminRulesAt;

  if (!onboarded) {
    redirect("/admin/onboarding");
  }

  // Soft-archived fallthrough (DISABLED / SUSPENDED / REMOVED). The auth
  // layer already blocks future sign-in, but an in-flight session might
  // still hit this layout once before the JWT refetch catches up. Render a
  // permanent block notice with a status-specific message.
  if (
    me?.adminStatus === AdminStatus.DISABLED ||
    me?.adminStatus === AdminStatus.SUSPENDED ||
    me?.adminStatus === AdminStatus.REMOVED
  ) {
    const copy =
      me.adminStatus === AdminStatus.SUSPENDED
        ? {
            title: "Your admin account is suspended",
            body: "A master admin temporarily suspended this account pending review. Reach out to the platform owner.",
          }
        : me.adminStatus === AdminStatus.REMOVED
        ? {
            title: "Your admin access has been removed",
            body: "This admin account has been archived. Past actions remain in the audit log, but you no longer have access.",
          }
        : {
            title: "Your admin account is disabled",
            body: "A master admin disabled this account. Reach out to the platform owner if you think this is wrong.",
          };
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl card p-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">{copy.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{copy.body}</p>
          <Link href="/" className="btn-secondary mt-4 inline-flex">
            Back to site
          </Link>
        </div>
      </div>
    );
  }

  // Pull every queue depth in parallel so the nav badges stay live without
  // blocking the page on serial queries.
  const [
    pendingVerifications,
    pendingAthleteConnections,
    pendingStudentConnections,
    pendingProgramRequests,
    openReports,
    pendingReviewModeration,
  ] = await Promise.all([
    // Every non-terminal verification status counts toward the queue badge.
    // Approved / rejected rows aren't actionable.
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
    // PENDING_REVIEW + FLAGGED reviews waiting on a human decision.
    prisma.review.count({
      where: { moderationStatus: { in: ["PENDING_REVIEW", "FLAGGED"] } },
    }),
  ]);

  return (
    <>
      <AdminNav
        isMaster={isMasterAdmin(session)}
        counts={{
          pendingVerifications,
          pendingAthleteConnections,
          pendingStudentConnections,
          pendingProgramRequests,
          openReports,
          pendingReviewModeration,
        }}
      />
      {/* If somehow an admin lands here with no permissions at all (edge
          case: master cleared every flag), the children may still be a
          dashboard tile that fails — let them through, they'll see "no
          access" inline rather than a hard crash. */}
      {!hasAnyAdminPermission(session) && (
        <div className="container-page pt-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            You're an admin but every permission is currently turned off.
            Contact a master admin to unlock queues.
          </div>
        </div>
      )}
      {children}
    </>
  );
}
