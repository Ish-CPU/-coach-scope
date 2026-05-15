import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/permissions";
import { canManageAdmins, normalizePermissions } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { AdminStatus, UserRole } from "@prisma/client";
import { AdminEditForm } from "@/components/admin/AdminEditForm";

export const dynamic = "force-dynamic";

/**
 * Detail page for a single admin/master row. Master can edit permissions,
 * disable/re-enable, reset password, resend invite, and update work email.
 *
 * Master rows are read-only here — managing the master account itself
 * happens at /admin/settings.
 */
export default async function AdminDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canManageAdmins(session)) redirect("/admin");

  const admin = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      workEmail: true,
      role: true,
      adminStatus: true,
      adminPermissions: true,
      lastLoginAt: true,
      createdAt: true,
      acceptedAdminRulesAt: true,
      inviteToken: true,
      inviteExpiresAt: true,
      removalReason: true,
      removalNote: true,
      sessionsRevokedAt: true,
    },
  });
  if (!admin) notFound();
  if (admin.role !== UserRole.ADMIN && admin.role !== UserRole.MASTER_ADMIN) notFound();

  const isMasterRow = admin.role === UserRole.MASTER_ADMIN;
  const perms = normalizePermissions(admin.adminPermissions);

  // Recent activity by this admin — gives master context before disabling.
  const recent = await prisma.adminActionLog.findMany({
    where: { actorUserId: admin.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{admin.name || admin.email}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {admin.email}
              {admin.workEmail && admin.workEmail !== admin.email
                ? ` · work: ${admin.workEmail}`
                : ""}
            </p>
          </div>
          <Link href="/admin/team" className="btn-secondary">
            ← Back
          </Link>
        </div>

        <div className="card p-4 text-xs text-slate-600">
          <div>
            <span className="font-medium">Role:</span> {admin.role}
          </div>
          <div className="mt-1">
            <span className="font-medium">Status:</span> {admin.adminStatus ?? "—"}
          </div>
          <div className="mt-1">
            <span className="font-medium">Created:</span>{" "}
            {new Date(admin.createdAt).toLocaleString()}
          </div>
          <div className="mt-1">
            <span className="font-medium">Last login:</span>{" "}
            {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : "never"}
          </div>
          <div className="mt-1">
            <span className="font-medium">Onboarded:</span>{" "}
            {admin.acceptedAdminRulesAt
              ? new Date(admin.acceptedAdminRulesAt).toLocaleString()
              : "no"}
          </div>
          {admin.inviteToken && admin.inviteExpiresAt && (
            <div className="mt-1">
              <span className="font-medium">Invite token expires:</span>{" "}
              {new Date(admin.inviteExpiresAt).toLocaleString()}
            </div>
          )}
          {admin.sessionsRevokedAt && (
            <div className="mt-1">
              <span className="font-medium">Sessions revoked:</span>{" "}
              {new Date(admin.sessionsRevokedAt).toLocaleString()}
            </div>
          )}
          {admin.removalReason && (
            <div className="mt-1">
              <span className="font-medium">Reason:</span> {admin.removalReason}
              {admin.removalNote ? ` — ${admin.removalNote}` : ""}
            </div>
          )}
        </div>

        {isMasterRow ? (
          <div className="card p-4 text-xs text-slate-600">
            This is the master admin account. Recovery emails, password and 2FA-ready
            controls live on the <Link href="/admin/settings" className="underline">settings page</Link>.
          </div>
        ) : (
          <AdminEditForm
            adminId={admin.id}
            currentPermissions={perms}
            currentStatus={admin.adminStatus ?? AdminStatus.ACTIVE}
            workEmail={admin.workEmail ?? ""}
            currentRemovalReason={admin.removalReason ?? null}
            currentRemovalNote={admin.removalNote ?? ""}
          />
        )}

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent activity
          </h2>
          <div className="mt-2 card divide-y divide-slate-100">
            {recent.length === 0 ? (
              <div className="p-3 text-xs text-slate-500">No recorded actions yet.</div>
            ) : (
              recent.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-3 p-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-slate-700">{row.action}</div>
                    {row.targetType && (
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {row.targetType}:{row.targetId ?? "?"}
                      </div>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-slate-400">
                    {new Date(row.createdAt).toLocaleString()}
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
