import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import { isMasterAdmin } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { RecoveryEmailsForm } from "@/components/admin/RecoveryEmailsForm";

export const dynamic = "force-dynamic";

/**
 * Master-only owner settings.
 *   - Recovery email list (used by the password reset flow as alternates)
 *   - Read-only profile summary
 *   - 2FA placeholder card so the slot is obvious when we wire TOTP
 */
export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!isMasterAdmin(session)) redirect("/admin");

  const me = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      id: true,
      email: true,
      workEmail: true,
      name: true,
      recoveryEmails: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!me) redirect("/admin");

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Owner settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Master-admin-only. Staff admins cannot view or change anything on this page.
          </p>
        </div>

        <section className="card p-4 text-xs text-slate-700 space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">Master account</h2>
          <div>
            <span className="font-medium">Login email:</span> {me.email}
          </div>
          {me.workEmail && me.workEmail !== me.email && (
            <div>
              <span className="font-medium">Work email:</span> {me.workEmail}
            </div>
          )}
          <div>
            <span className="font-medium">Created:</span>{" "}
            {new Date(me.createdAt).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Last login:</span>{" "}
            {me.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString() : "never"}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Recovery emails</h2>
          <p className="mt-1 text-xs text-slate-500">
            Backup addresses your account can recover to if the primary email is lost.
            The reset flow sends a code to one of these in addition to the primary.
          </p>
          <div className="mt-3">
            <RecoveryEmailsForm initial={me.recoveryEmails} />
          </div>
        </section>

        <section className="card p-4 text-xs text-slate-600">
          <h2 className="text-sm font-semibold text-slate-900">Two-factor authentication</h2>
          <p className="mt-1">
            2FA is stubbed in the schema (recovery emails + invite tokens) but not yet
            wired. Once enabled, a TOTP enrollment flow will live here.
          </p>
        </section>
      </div>
    </div>
  );
}
