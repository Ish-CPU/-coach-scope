import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/Badge";
import { AthleteVerificationForm } from "@/components/verification/AthleteVerificationForm";
import { EmailCodeVerificationForm } from "@/components/verification/EmailCodeVerificationForm";
import { StudentIdUploadForm } from "@/components/verification/StudentIdUploadForm";
import { RecruitVerificationForm } from "@/components/verification/RecruitVerificationForm";
import { RecruitUpgradeForm } from "@/components/verification/RecruitUpgradeForm";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?callbackUrl=/verification");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { verificationRequests: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  // MVP: payment is not gated — Stripe isn't wired yet. Re-add the
  // `isPaymentVerified` gate above once subscriptions ship.

  if (user.role === UserRole.VIEWER) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl card p-6 text-center">
          <h1 className="text-xl font-bold">Pick a role first</h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose how you'll use University Verified so we can give you the right verification flow.
          </p>
          <Link href="/onboarding" className="btn-primary mt-4 inline-flex">Choose your role</Link>
        </div>
      </div>
    );
  }

  const verifiedAlready = user.verificationStatus === "VERIFIED";
  const pending = user.verificationStatus === "PENDING";

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Verify your role</h1>
        <p className="mt-1 text-sm text-slate-600">
          What we ask for depends on your role. Verification keeps reviews honest by ensuring
          every contributor is who they claim to be.
        </p>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span>Current status:</span>
          <Badge role={user.role} />
          <span className="text-slate-500">· {user.verificationStatus.toLowerCase()}</span>
        </div>

        <div className="mt-6">
          {/* Verified recruits get a different post-approval surface than
              everyone else: their "I'm verified" card invites them to
              upgrade to Verified Athlete on the same account once they
              enroll. The upgrade form below files a NEW VerificationRequest
              targeting VERIFIED_ATHLETE (or _ALUMNI for transfer recruits).
              Prior reviews, RECRUITED_BY connections, and subscription all
              stay attached. */}
          {verifiedAlready && user.role === UserRole.VERIFIED_RECRUIT ? (
            <div className="space-y-4">
              <div className="card p-4 text-sm text-emerald-800">
                You're a <strong>Verified Recruit</strong>. You can post Recruiting
                Experience Reviews for schools that recruited you. When you commit and
                enroll, upgrade below — your recruit history stays attached to this
                account.
              </div>
              <RecruitUpgradeForm disabled={pending} />
            </div>
          ) : verifiedAlready ? (
            <div className="card p-4 text-sm text-emerald-800">
              You're verified. You can now post reviews, vote on what's helpful, and join
              your role's groups.
            </div>
          ) : user.role === UserRole.VERIFIED_ATHLETE ? (
            <AthleteVerificationForm disabled={pending} />
          ) : user.role === UserRole.VERIFIED_ATHLETE_ALUMNI ? (
            <AthleteVerificationForm disabled={pending} alumni />
          ) : user.role === UserRole.VERIFIED_RECRUIT ? (
            <RecruitVerificationForm disabled={pending} />
          ) : user.role === UserRole.VERIFIED_STUDENT ? (
            <StudentVerificationOptions disabled={pending} />
          ) : user.role === UserRole.VERIFIED_STUDENT_ALUMNI ? (
            <StudentVerificationOptions disabled={pending} alumni />
          ) : user.role === UserRole.VERIFIED_PARENT ? (
            <ParentVerificationOptions disabled={pending} />
          ) : (
            <div className="card p-4 text-sm text-slate-500">
              No verification required for this role.
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold">Your requests</h2>
          <div className="mt-3 space-y-2">
            {user.verificationRequests.length === 0 ? (
              <div className="card p-4 text-sm text-slate-500">No requests yet.</div>
            ) : (
              user.verificationRequests.map((r) => (
                <div key={r.id} className="card p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {r.method.replace("_", " ").toLowerCase()}
                        {r.targetRole !== UserRole.VIEWER && ` · ${r.targetRole.replace("_", " ").toLowerCase()}`}
                        {r.attemptNumber > 1 && ` · attempt ${r.attemptNumber}`}
                      </div>
                      <div className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                    <span
                      className={`badge ${
                        r.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : r.status === "NEEDS_MORE_INFO"
                          ? "bg-orange-100 text-orange-800"
                          : r.status === "HIGH_CONFIDENCE"
                          ? "bg-emerald-50 text-emerald-700"
                          : r.status === "LOW_CONFIDENCE"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>
                  {r.rejectionReason && (
                    <p
                      className={`mt-2 rounded-lg p-2 text-xs ${
                        r.status === "REJECTED"
                          ? "bg-red-50 text-red-800"
                          : "bg-orange-50 text-orange-800"
                      }`}
                    >
                      <strong>
                        {r.status === "REJECTED" ? "Why rejected:" : "Admin needs more info:"}
                      </strong>{" "}
                      {r.rejectionReason}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Students may verify two ways per the verification spec:
 *   - .edu email code (fastest)
 *   - student ID upload (manual review fallback)
 *
 * `alumni` swaps copy + form labels for Verified Student Alumni — same
 * structural flow, but acknowledging that some alumni may no longer have an
 * active school-issued email.
 */
function StudentVerificationOptions({
  disabled,
  alumni = false,
}: {
  disabled: boolean;
  alumni?: boolean;
}) {
  if (disabled) {
    return (
      <div className="card p-4 text-sm text-slate-600">
        You already have a pending request — sit tight while an admin reviews it.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <h4 className="font-semibold">
          How we verify {alumni ? "student alumni" : "students"}
        </h4>
        <ul className="mt-2 space-y-1 text-xs">
          {alumni ? (
            <>
              <li>
                • If you still have an active <strong>.edu email</strong>, use the email-code
                flow — fastest path.
              </li>
              <li>
                • Otherwise upload a <strong>student ID, diploma, transcript, or alumni
                card</strong> — manually reviewed, never auto-approved.
              </li>
            </>
          ) : (
            <>
              <li>• A school <strong>.edu email</strong> is the fastest path.</li>
              <li>
                • Or upload a <strong>student ID</strong> — manual review by an admin, never
                auto-approved.
              </li>
            </>
          )}
          <li>• Fake or AI-generated proof leads to rejection and account removal.</li>
        </ul>
      </div>
      <EmailCodeVerificationForm
        purposeLabel={
          alumni ? "Student alumni .edu verification" : "Student .edu verification"
        }
        requireEdu
      />
      <div className="text-center text-xs uppercase tracking-wider text-slate-400">
        — or —
      </div>
      <StudentIdUploadForm alumni={alumni} />
    </div>
  );
}

function ParentVerificationOptions({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <div className="card p-4 text-sm text-slate-600">
        You already have a pending request — sit tight while an admin reviews it.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <h4 className="font-semibold">How we verify parents</h4>
        <ul className="mt-2 space-y-1 text-xs">
          <li>• Confirm an email address with a 6-digit code.</li>
          <li>
            • Some parents are asked to provide additional documentation showing a parent-of-athlete
            relationship — this is reviewed manually.
          </li>
          <li>• Fake or fraudulent documentation leads to account removal.</li>
        </ul>
      </div>
      <EmailCodeVerificationForm purposeLabel="Parent email verification" />
    </div>
  );
}
