import Link from "next/link";
import { redirect } from "next/navigation";
import {
  allowedReviewTypes,
  getSession,
  groupTypeForRole,
  isPaymentVerified,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge, ROLE_DESCRIPTIONS } from "@/components/Badge";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { ManageBillingButton } from "@/components/ManageBillingButton";
import { GROUP_TYPE_LABELS } from "@/lib/groups";
import { UserRole, VerificationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?callbackUrl=/dashboard");

  // Single canonical query — every field rendered below is derived from
  // this fresh DB read so a verification approval that lands between
  // requests is reflected immediately without waiting for a token TTL.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: {
      reviews: { orderBy: { createdAt: "desc" }, take: 10 },
      favorites: {
        include: { coach: true, university: true, dorm: true, school: { include: { university: true } } },
      },
      subscription: true,
      // Most-recent verification request drives the Pending / Denied UI
      // states. Take 1 — order by createdAt desc — gives us the row that
      // matters for "what should I show right now."
      // Full request history powers two UI surfaces:
      //   1. Latest row (index 0) drives the Verify / Pending / Denied CTA.
      //   2. Approved rows in chronological order drive the recruit-→-athlete
      //      timeline shown on the dashboard for recruits.
      // Cap at 10 so an over-eager admin re-submitter doesn't bloat the
      // dashboard payload.
      verificationRequests: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  const paid = isPaymentVerified(session);
  const verified = user.verificationStatus === VerificationStatus.VERIFIED;
  const myGroupType = groupTypeForRole(user.role);
  const reviewTypes = allowedReviewTypes(session);

  // Verification UX state (resolved server-side from DB, not from the
  // session token, so it's always fresh):
  //   verified  — green badge + label, no Verify button
  //   pending   — "Verification Pending" pill, button disabled
  //   denied    — "Verification Denied" pill, allow re-submission
  //   none      — plain "Verify your role" CTA
  const latestRequest = user.verificationRequests[0] ?? null;
  type VerificationUiState = "verified" | "pending" | "denied" | "none";
  const verificationState: VerificationUiState = verified
    ? "verified"
    : latestRequest?.status === "REJECTED"
    ? "denied"
    : latestRequest &&
      // Anything that isn't a terminal state counts as "still in flight".
      ["PENDING", "HIGH_CONFIDENCE", "NEEDS_REVIEW", "LOW_CONFIDENCE", "NEEDS_MORE_INFO"].includes(
        latestRequest.status
      )
    ? "pending"
    : "none";

  // Pretty role label used by the Verified card. We fall back to the badge
  // role when the role isn't in the descriptions map (older roles, etc.).
  const roleLabel = ROLE_DESCRIPTIONS[user.role] ? user.role.replace(/_/g, " ") : null;

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user.name?.split(" ")[0] ?? "friend"}.</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge role={user.role} />
            <span className="text-slate-400">·</span>
            <span>payment {paid ? "verified" : "—"}</span>
            <span className="text-slate-400">·</span>
            <span>role {user.verificationStatus.toLowerCase()}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {reviewTypes.length > 0 && (
            <Link href="/review/new" className="btn-primary">Write a review</Link>
          )}
          <Link href="/groups" className="btn-secondary">Verified Groups</Link>
          {/* Verify CTA: only render for roles that need it AND only when
              the user isn't already verified or mid-review. Pending /
              denied get their own status pill below the header. */}
          {user.role !== UserRole.VIEWER && verificationState === "none" && (
            <Link href="/verification" className="btn-secondary">Verify your role</Link>
          )}
          {user.role !== UserRole.VIEWER && verificationState === "pending" && (
            <span
              className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800"
              aria-disabled="true"
            >
              Verification Pending
            </span>
          )}
          {user.role !== UserRole.VIEWER && verificationState === "denied" && (
            <Link
              href="/verification"
              className="inline-flex items-center rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Verification Denied · Resubmit
            </Link>
          )}
          {paid && <ManageBillingButton />}
        </div>
      </div>

      {/* Two-layer status banners */}
      {!paid && (
        <div className="mt-6">
          <UpgradePrompt />
        </div>
      )}

      {/* Verified — show role badge, label, and entitlements. Verified
          recruits get an extra Upgrade-to-Athlete CTA so the bridge is
          obvious from the dashboard, not buried under /verification. */}
      {verified && (
        <div className="mt-6 card p-5 bg-emerald-50 border-emerald-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge role={user.role} />
              {roleLabel && (
                <span className="text-xs uppercase tracking-wider text-emerald-700">
                  {roleLabel}
                </span>
              )}
            </div>
            <h3 className="mt-2 text-base font-semibold text-emerald-900">
              You're verified.
            </h3>
            <p className="mt-1 text-sm text-emerald-800">
              {user.role === UserRole.VERIFIED_RECRUIT
                ? "You can post Recruiting Experience Reviews for schools that recruited you. When you commit and enroll, upgrade to Verified Athlete on the same account."
                : myGroupType
                ? `You can post the reviews your role allows and participate in ${GROUP_TYPE_LABELS[myGroupType]}.`
                : "You can post the reviews your role allows."}
            </p>
          </div>
          {user.role === UserRole.VERIFIED_RECRUIT && (
            <Link href="/verification" className="btn-primary whitespace-nowrap">
              Upgrade to Athlete →
            </Link>
          )}
        </div>
      )}

      {/* Verification timeline. Rendered when the user has at least one
          approved request — useful for recruits who upgraded so they can
          see the progression Recruit → Verified Athlete on their profile.
          Built from approved requests in chronological (createdAt asc)
          order so the latest stage sits at the end of the line. */}
      {(() => {
        const approved = user.verificationRequests
          .filter((r) => r.status === "APPROVED" && r.reviewedAt)
          .slice()
          .reverse(); // already DESC; flip to chronological
        // Only render when there's an actual transition worth showing
        // (more than one stage, OR a recruit who's started upgrading).
        const showTimeline =
          approved.length > 1 ||
          (approved.length === 1 && user.role === UserRole.VERIFIED_RECRUIT);
        if (!showTimeline) return null;
        return (
          <div className="mt-6 card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Verification timeline
            </h3>
            <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {approved.map((r, i) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800">
                    {(r.targetRole as string).replace(/_/g, " ").toLowerCase()}
                    {r.reviewedAt && (
                      <span className="ml-1 text-emerald-600">
                        · {new Date(r.reviewedAt).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                  {i < approved.length - 1 && (
                    <span className="text-slate-400">→</span>
                  )}
                </li>
              ))}
              {/* If a pending request follows the last approval, surface
                  it as the next-step pill so the user sees the in-flight
                  upgrade. */}
              {user.verificationRequests[0] &&
                user.verificationRequests[0].status !== "APPROVED" &&
                user.verificationRequests[0].status !== "REJECTED" && (
                  <li className="flex items-center gap-2">
                    <span className="text-slate-400">→</span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-800">
                      {(
                        user.verificationRequests[0].targetRole as string
                      )
                        .replace(/_/g, " ")
                        .toLowerCase()}
                      {" "}· pending
                    </span>
                  </li>
                )}
            </ol>
          </div>
        );
      })()}

      {/* Pending — admin hasn't actioned the latest submission yet. */}
      {!verified &&
        verificationState === "pending" &&
        user.role !== UserRole.VIEWER && (
          <div className="mt-6 card p-5 bg-amber-50 border-amber-200">
            <h3 className="text-base font-semibold text-amber-900">
              Verification Pending
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              An admin is reviewing your submission. You'll be unlocked the moment
              it's approved — no further action needed.
            </p>
            <Link
              href="/verification"
              className="mt-3 inline-flex text-sm font-medium text-amber-900 underline"
            >
              View submission
            </Link>
          </div>
        )}

      {/* Denied — surface the rejection reason and let the user resubmit. */}
      {!verified &&
        verificationState === "denied" &&
        user.role !== UserRole.VIEWER && (
          <div className="mt-6 card p-5 bg-red-50 border-red-200">
            <h3 className="text-base font-semibold text-red-900">
              Verification Denied
            </h3>
            <p className="mt-1 text-sm text-red-800">
              An admin couldn't verify your last submission. You can submit a new
              one with stronger evidence.
            </p>
            {latestRequest?.rejectionReason && (
              <p className="mt-2 rounded-lg bg-red-100/70 p-2 text-xs text-red-900">
                <strong>Admin note:</strong> {latestRequest.rejectionReason}
              </p>
            )}
            <Link href="/verification" className="btn-primary mt-3 inline-flex">
              Resubmit verification
            </Link>
          </div>
        )}

      {/* No request yet — paid + role picked but never tried to verify. */}
      {!verified &&
        verificationState === "none" &&
        user.role !== UserRole.VIEWER && (
          <div className="mt-6 card p-5 bg-amber-50 border-amber-200">
            <h3 className="text-base font-semibold text-amber-900">
              Verify your role to unlock posting
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              Finish role verification to start posting reviews
              {myGroupType ? ` and join ${GROUP_TYPE_LABELS[myGroupType]}` : ""}.
            </p>
            <Link href="/verification" className="btn-primary mt-3 inline-flex">
              Start verification
            </Link>
          </div>
        )}

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Your reviews</h2>
          <div className="mt-3 space-y-3">
            {user.reviews.length === 0 ? (
              <div className="card p-6 text-sm text-slate-500">You haven't posted any reviews yet.</div>
            ) : (
              user.reviews.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-slate-500">{r.reviewType}</div>
                    <div className="text-sm font-semibold">{r.overall.toFixed(1)} / 5</div>
                  </div>
                  {r.title && <div className="mt-1 font-medium">{r.title}</div>}
                  <div className="mt-1 line-clamp-2 text-sm text-slate-600">{r.body}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Saved favorites</h2>
          <div className="mt-3 space-y-3">
            {user.favorites.length === 0 ? (
              <div className="card p-6 text-sm text-slate-500">No favorites yet.</div>
            ) : (
              user.favorites.map((f) => {
                const label = f.coach?.name
                  ?? f.university?.name
                  ?? f.dorm?.name
                  ?? (f.school ? `${f.school.university.name} ${f.school.sport}` : "Saved");
                const href = f.coach
                  ? `/coach/${f.coach.id}`
                  : f.university
                  ? `/university/${f.university.id}`
                  : f.dorm
                  ? `/dorm/${f.dorm.id}`
                  : "#";
                return (
                  <Link key={f.id} href={href} className="card flex items-center justify-between p-4 hover:shadow-card">
                    <span>{label}</span>
                    <span className="text-sm text-brand-700">View →</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
