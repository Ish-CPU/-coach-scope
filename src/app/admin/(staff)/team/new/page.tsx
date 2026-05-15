import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import { canManageAdmins, DEFAULT_ADMIN_PERMISSIONS } from "@/lib/admin-permissions";
import { AdminInviteForm } from "@/components/admin/AdminInviteForm";

export const dynamic = "force-dynamic";

export default async function NewAdminPage() {
  const session = await getSession();
  if (!canManageAdmins(session)) redirect("/admin");

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900">Invite admin</h1>
        <p className="mt-1 text-sm text-slate-600">
          Creates a staff admin in <span className="font-medium">INVITED</span> status.
          You'll get back either an invite link (recommended) or a temporary password to
          share securely with the new admin.
        </p>

        <div className="mt-6">
          <AdminInviteForm defaultPermissions={DEFAULT_ADMIN_PERMISSIONS} />
        </div>
      </div>
    </div>
  );
}
