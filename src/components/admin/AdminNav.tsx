import Link from "next/link";

/**
 * Compact admin nav rendered at the top of every /admin/* page via the
 * admin layout. Server component — pulls live pending counts so admins
 * see queue depth at a glance.
 *
 * Master-only links (Team, Settings) only render when `isMaster` is true.
 * Per-page guards still enforce the permission server-side; the conditional
 * here just keeps the nav clean for staff admins who can't follow the link
 * anyway.
 */
interface Props {
  isMaster: boolean;
  counts: {
    pendingVerifications: number;
    pendingAthleteConnections: number;
    pendingStudentConnections: number;
    pendingProgramRequests: number;
    openReports: number;
    pendingReviewModeration: number;
  };
}

interface NavLink {
  href: string;
  label: string;
  pendingKey?: keyof Props["counts"];
  masterOnly?: boolean;
}

const LINKS: NavLink[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/verifications", label: "Verifications", pendingKey: "pendingVerifications" },
  { href: "/admin/connections", label: "Connections" },
  { href: "/admin/requests", label: "Program Requests", pendingKey: "pendingProgramRequests" },
  { href: "/admin/reports", label: "Reports", pendingKey: "openReports" },
  { href: "/admin/reviews", label: "Reviews", pendingKey: "pendingReviewModeration" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/imports", label: "CSV Imports" },
  // Master-only — admin team & owner settings (recovery emails, etc.)
  { href: "/admin/team", label: "Team", masterOnly: true },
  { href: "/admin/settings", label: "Settings", masterOnly: true },
];

export function AdminNav({ counts, isMaster }: Props) {
  const visible = LINKS.filter((l) => !l.masterOnly || isMaster);
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="container-page flex flex-wrap items-center gap-3 py-3 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {isMaster ? "Master Admin" : "Admin"}
        </span>
        {visible.map((l) => {
          const pending = l.pendingKey ? counts[l.pendingKey] : 0;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              {l.label}
              {pending > 0 && (
                <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
