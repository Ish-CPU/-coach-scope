import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import { canManageAdmins } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { AdminStatus, UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<AdminStatus, string> = {
  INVITED: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  DISABLED: "bg-slate-200 text-slate-600",
  SUSPENDED: "bg-orange-100 text-orange-800",
  REMOVED: "bg-rose-100 text-rose-800",
};

// Bucketed sections so master can scan active vs blocked vs archived at a
// glance. Active first, then onboarding, then everything blocked. Empty
// sections are hidden so the page stays compact for new deployments.
const SECTION_ORDER: { status: AdminStatus; label: string; description: string }[] = [
  {
    status: AdminStatus.ACTIVE,
    label: "Active",
    description: "Currently can sign in and use their permissions.",
  },
  {
    status: AdminStatus.INVITED,
    label: "Awaiting onboarding",
    description: "Invited but haven't completed setup yet.",
  },
  {
    status: AdminStatus.SUSPENDED,
    label: "Suspended",
    description: "Temporarily blocked pending review. Reactivate to restore access.",
  },
  {
    status: AdminStatus.DISABLED,
    label: "Disabled",
    description: "Hard-stopped. Sign-in is rejected and every permission is zero.",
  },
  {
    status: AdminStatus.REMOVED,
    label: "Removed (archived)",
    description:
      "Former admins. Row preserved for audit history, no longer holds any access.",
  },
];

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  ADMIN: "Admin",
  MASTER_ADMIN: "Master",
};

/**
 * Master-only roster of every admin account, bucketed by status. Each row
 * links to the detail page where the master can change status, edit
 * permissions, force-logout, etc.
 */
export default async function AdminTeamPage() {
  const session = await getSession();
  if (!canManageAdmins(session)) redirect("/admin");

  const admins = await prisma.user.findMany({
    where: { role: { in: [UserRole.ADMIN, UserRole.MASTER_ADMIN] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      workEmail: true,
      role: true,
      adminStatus: true,
      lastLoginAt: true,
      createdAt: true,
      acceptedAdminRulesAt: true,
      removalReason: true,
    },
  });

  // Group by adminStatus. Master admins sit in their own pseudo-section so
  // they're never tucked into "active" alongside staff.
  const byStatus = new Map<AdminStatus | "MASTER", typeof admins>();
  for (const a of admins) {
    if (a.role === UserRole.MASTER_ADMIN) {
      const arr = byStatus.get("MASTER") ?? [];
      arr.push(a);
      byStatus.set("MASTER", arr);
    } else if (a.adminStatus) {
      const arr = byStatus.get(a.adminStatus) ?? [];
      arr.push(a);
      byStatus.set(a.adminStatus, arr);
    }
  }

  const totals = {
    active: byStatus.get(AdminStatus.ACTIVE)?.length ?? 0,
    invited: byStatus.get(AdminStatus.INVITED)?.length ?? 0,
    suspended: byStatus.get(AdminStatus.SUSPENDED)?.length ?? 0,
    disabled: byStatus.get(AdminStatus.DISABLED)?.length ?? 0,
    removed: byStatus.get(AdminStatus.REMOVED)?.length ?? 0,
    masters: byStatus.get("MASTER")?.length ?? 0,
  };

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin team</h1>
            <p className="mt-1 text-sm text-slate-600">
              Master admin only. Invite staff, change status, edit per-action permissions,
              force logout, and reset passwords. Records are archived — never hard-deleted.
            </p>
          </div>
          <Link href="/admin/team/new" className="btn-primary">
            Invite admin
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <Pill tone="emerald">{totals.active} active</Pill>
          {totals.invited > 0 && <Pill tone="amber">{totals.invited} invited</Pill>}
          {totals.suspended > 0 && <Pill tone="orange">{totals.suspended} suspended</Pill>}
          {totals.disabled > 0 && <Pill tone="slate">{totals.disabled} disabled</Pill>}
          {totals.removed > 0 && <Pill tone="rose">{totals.removed} removed</Pill>}
          <Pill tone="indigo">{totals.masters} master</Pill>
        </div>

        {/* Master admins always render at the top, untouched by the bucketing. */}
        {(byStatus.get("MASTER") ?? []).length > 0 && (
          <Section
            label="Master admins"
            description="Owner accounts. Managed from /admin/settings, not the team list."
          >
            {(byStatus.get("MASTER") ?? []).map((a) => (
              <AdminRow key={a.id} admin={a} />
            ))}
          </Section>
        )}

        {SECTION_ORDER.map((s) => {
          const rows = byStatus.get(s.status) ?? [];
          if (rows.length === 0) return null;
          return (
            <Section key={s.status} label={s.label} description={s.description}>
              {rows.map((a) => (
                <AdminRow key={a.id} admin={a} />
              ))}
            </Section>
          );
        })}

        {admins.length === 0 && (
          <div className="mt-6 card p-6 text-sm text-slate-500">
            No admins yet — invite your first staff admin above.
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "emerald" | "amber" | "orange" | "slate" | "rose" | "indigo";
  children: React.ReactNode;
}) {
  const TONE: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    orange: "bg-orange-100 text-orange-800",
    slate: "bg-slate-200 text-slate-700",
    rose: "bg-rose-100 text-rose-800",
    indigo: "bg-indigo-100 text-indigo-800",
  };
  return (
    <span className={`rounded-full px-2 py-1 font-medium ${TONE[tone]}`}>{children}</span>
  );
}

function Section({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </h2>
        <p className="text-[11px] text-slate-400">{description}</p>
      </div>
      <div className="mt-2 card divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function AdminRow({
  admin,
}: {
  admin: {
    id: string;
    name: string | null;
    email: string;
    workEmail: string | null;
    role: UserRole;
    adminStatus: AdminStatus | null;
    lastLoginAt: Date | null;
    acceptedAdminRulesAt: Date | null;
    removalReason: string | null;
  };
}) {
  return (
    <Link
      href={`/admin/team/${admin.id}`}
      className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">
            {admin.name || admin.email}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {ROLE_LABEL[admin.role] ?? admin.role}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {admin.email}
          {admin.workEmail && admin.workEmail !== admin.email
            ? ` · work: ${admin.workEmail}`
            : ""}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          {admin.lastLoginAt
            ? `Last login ${new Date(admin.lastLoginAt).toLocaleString()}`
            : admin.acceptedAdminRulesAt
            ? "Onboarded · never signed in since"
            : "Never signed in"}
          {admin.removalReason ? ` · ${admin.removalReason.toLowerCase()}` : ""}
        </div>
      </div>
      {admin.adminStatus && (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[admin.adminStatus]}`}
        >
          {admin.adminStatus.toLowerCase()}
        </span>
      )}
    </Link>
  );
}
