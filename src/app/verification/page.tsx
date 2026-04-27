import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isPaymentVerified } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/Badge";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { AthleteVerificationForm } from "@/components/verification/AthleteVerificationForm";
import { EmailCodeVerificationForm } from "@/components/verification/EmailCodeVerificationForm";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?callbackUrl=/verification");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { verificationRequests: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  if (!isPaymentVerified(session) && user.role !== UserRole.ADMIN) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl">
          <UpgradePrompt message="An active subscription is required before verifying your role." />
        </div>
      </div>
    );
  }

  if (user.role === UserRole.VIEWER) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl card p-6 text-center">
          <h1 className="text-xl font-bold">Pick a role first</h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose your role on the pricing page so we know which verification flow to give you.
          </p>
          <Link href="/pricing" className="btn-primary mt-4 inline-flex">Go to pricing</Link>
        </div>
      </div>
    );
  }

  const verifiedAlready = user.verificationStatus === "VERIFIED";

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Verify your role</h1>
        <p className="mt-1 text-sm text-slate-600">
          You've completed payment. The next step is role verification — what we ask for depends on your role.
        </p>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span>Current status:</span>
          <Badge role={user.role} />
          <span className="text-slate-500">· {user.verificationStatus.toLowerCase()}</span>
        </div>

        <div className="mt-6">
          {verifiedAlready ? (
            <div className="card p-4 text-sm text-emerald-800">
              You're verified. You can now post, vote, and join your role's groups.
            </div>
          ) : user.role === UserRole.VERIFIED_ATHLETE ? (
            <AthleteVerificationForm
              disabled={user.verificationStatus === "PENDING"}
            />
          ) : user.role === UserRole.VERIFIED_STUDENT ? (
            <EmailCodeVerificationForm purposeLabel="Student .edu verification" requireEdu />
          ) : user.role === UserRole.VERIFIED_PARENT ? (
            <EmailCodeVerificationForm purposeLabel="Parent email verification" />
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
                <div key={r.id} className="card flex items-center justify-between p-4 text-sm">
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
                      r.status === "VERIFIED"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.status.toLowerCase()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
