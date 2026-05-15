import Link from "next/link";
import { redirect } from "next/navigation";
import {
  describeGate,
  getSession,
  groupTypeForRole,
  whyCannotParticipate,
} from "@/lib/permissions";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { CreateGroupForm } from "@/components/groups/CreateGroupForm";
import { GROUP_TYPE_LABELS } from "@/lib/groups";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function NewGroupPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?callbackUrl=/groups/new");

  const gate = whyCannotParticipate(session);
  if (gate) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl space-y-4">
          {gate === "role-not-verified" ? (
            <div className="card p-6">
              <h2 className="text-lg font-semibold">Verify your role first</h2>
              <p className="mt-2 text-sm text-slate-600">
                Payment is complete — finish role verification to create groups.
              </p>
              <Link href="/verification" className="btn-primary mt-4 inline-flex">
                Continue verification
              </Link>
            </div>
          ) : (
            <UpgradePrompt message={describeGate(gate)} />
          )}
        </div>
      </div>
    );
  }

  const myType =
    session.user.role === UserRole.ADMIN || session.user.role === UserRole.MASTER_ADMIN ? null : groupTypeForRole(session.user.role);

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold">Create a Verified Group</h1>
        <p className="mt-1 text-sm text-slate-600">
          {myType
            ? `You can only create ${GROUP_TYPE_LABELS[myType].toLowerCase()} (matching your role).`
            : "Admin: you can create groups for any audience."}
        </p>
        <div className="mt-6">
          <CreateGroupForm fixedType={myType ?? undefined} />
        </div>
      </div>
    </div>
  );
}
