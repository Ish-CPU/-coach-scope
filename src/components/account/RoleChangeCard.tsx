/**
 * Server-rendered card on /account/settings for the role-change flow.
 *
 * Renders:
 *   - The user's current role
 *   - The request form (client component) — disabled when the user
 *     has no active sub or already has a pending request
 *   - A compact history of past requests (latest 5) with status pills
 *     and any admin note that came back
 *
 * Data is fetched here on the server so the page renders without a
 * client roundtrip flicker.
 */
import { prisma } from "@/lib/prisma";
import { RoleChangeRequestForm } from "@/components/account/RoleChangeRequestForm";
import { statusGrantsAccess } from "@/lib/subscription";
import {
  RequestStatus,
  type SubscriptionStatus,
  type UserRole,
} from "@prisma/client";

interface Props {
  userId: string;
  currentRole: UserRole;
  subscriptionStatus: SubscriptionStatus;
}

function friendlyRole(r: string): string {
  return r.replace(/_/g, " ").toLowerCase();
}

function statusPill(s: RequestStatus): { cls: string; label: string } {
  if (s === RequestStatus.APPROVED) {
    return { cls: "bg-emerald-100 text-emerald-800", label: "approved" };
  }
  if (s === RequestStatus.REJECTED) {
    return { cls: "bg-slate-200 text-slate-700", label: "rejected" };
  }
  return { cls: "bg-amber-100 text-amber-800", label: "pending" };
}

export async function RoleChangeCard({
  userId,
  currentRole,
  subscriptionStatus,
}: Props) {
  // Admins shouldn't see this card — admin role isn't user-changeable
  // here. The API + onboarding endpoint both reject it; hide the UI too.
  if (currentRole === "ADMIN" || currentRole === "MASTER_ADMIN") {
    return null;
  }

  const recent = await prisma.roleChangeRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      currentRole: true,
      requestedRole: true,
      status: true,
      adminNote: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  const hasPending = recent.some((r) => r.status === RequestStatus.PENDING);
  const hasActiveSub = statusGrantsAccess(subscriptionStatus);

  return (
    <section className="card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Change your role</h2>
          <p className="mt-1 text-sm text-slate-600">
            Submit a request to switch roles (e.g. athlete → alumni,
            recruit → athlete). Your subscription stays the same — no
            double-charge. An admin reviews each request.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          Current: {friendlyRole(currentRole)}
        </span>
      </header>

      <div className="mt-4">
        <RoleChangeRequestForm
          currentRole={currentRole}
          hasActiveSub={hasActiveSub}
          hasPending={hasPending}
        />
      </div>

      {recent.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent requests
          </h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {recent.map((r) => {
              const pill = statusPill(r.status);
              return (
                <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
                  <span className="text-slate-700">
                    <span className="text-slate-500">{friendlyRole(r.currentRole)}</span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span className="font-medium text-slate-900">
                      {friendlyRole(r.requestedRole)}
                    </span>
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${pill.cls}`}>
                    {pill.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {r.createdAt.toISOString().slice(0, 10)}
                  </span>
                  {r.adminNote && (
                    <p className="mt-1 w-full rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      <span className="font-semibold">Admin note:</span> {r.adminNote}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
