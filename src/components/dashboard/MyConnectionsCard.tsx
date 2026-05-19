import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  AthleteConnectionStatus,
  AthleteConnectionType,
  StudentConnectionStatus,
  StudentConnectionType,
  UserRole,
} from "@prisma/client";
import {
  isAthleteTrustedRole,
  isRecruitRole,
  isStudentTrustedRole,
} from "@/lib/permissions";

// ---------------------------------------------------------------------------
// "My Connections" — compact dashboard card
// ---------------------------------------------------------------------------
//
// What this codebase calls a "connection" is a user → University/Program
// affiliation row (AthleteProgramConnection / StudentUniversityConnection),
// not a user → user social graph. This card surfaces the latest 5 APPROVED
// rows the signed-in user owns, with a link to /connections for full
// management.
//
// Reused on:
//   - /dashboard (primary placement)
//   - /account/settings (read-only summary variant, opts into compact=true)
//
// Hidden entirely for roles that have no connection model: VIEWER, ADMIN,
// MASTER_ADMIN, VERIFIED_PARENT. Returning null from a server component
// renders nothing — parent pages don't need to wrap us in a conditional.

// Type-label maps mirror the strings on the /connections page. Kept here
// (not in a shared lib) because they're tiny and only two surfaces use
// them — extracting now would be premature.
const ATHLETE_TYPE_LABELS: Record<AthleteConnectionType, string> = {
  CURRENT_ATHLETE: "Current athlete",
  ATHLETE_ALUMNI: "Athlete alumni",
  RECRUITED_BY: "Recruited by",
  TRANSFERRED_FROM: "Transferred from",
  COMMITTED: "Committed",
  WALK_ON: "Walk-on",
};

const STUDENT_TYPE_LABELS: Record<StudentConnectionType, string> = {
  CURRENT_STUDENT: "Current student",
  STUDENT_ALUMNI: "Student alumni",
  ADMITTED_TO: "Admitted (didn't enroll)",
  TRANSFERRED_FROM: "Transferred from",
  VISITED_CAMPUS: "Visited campus",
};

interface UnifiedConnection {
  id: string;
  kind: "athlete" | "student";
  typeLabel: string;
  universityName: string;
  universityState: string | null;
  sport: string | null;
  startYear: number | null;
  endYear: number | null;
  createdAt: Date;
}

interface Props {
  userId: string;
  role: UserRole;
  /**
   * When true, render a leaner version meant for sidebars / settings pages:
   * smaller header, no description copy, no per-row date column. The data
   * shown is otherwise identical.
   */
  compact?: boolean;
  /** Override the default cap of 5 rows. Useful for the compact summary. */
  limit?: number;
}

/** Format a year range like "2022 – 2024" or "2024 – present" or "2024". */
function formatYears(start: number | null, end: number | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${start} – ${end}`;
  if (start && !end) return `${start} – present`;
  return String(end);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function MyConnectionsCard({
  userId,
  role,
  compact = false,
  limit = 5,
}: Props) {
  // Same role gating as /connections, minus the admin branch — admins
  // manage other users' connections from /admin/connections, not their
  // own. Parents have no connection model at all.
  const showAthlete = isAthleteTrustedRole(role) || isRecruitRole(role);
  const showStudent = isStudentTrustedRole(role);

  if (!showAthlete && !showStudent) {
    // Nothing to render for this role. Returning null keeps the parent
    // dashboard layout simple — no wrapper conditional needed.
    return null;
  }

  // Pull both sides in parallel. Each query is bounded by `limit` so the
  // worst-case payload is 2× the cap before in-memory merge + slice.
  // Filter to APPROVED only — the prompt is explicit that pending /
  // rejected rows do not belong on the dashboard summary.
  const [athleteRows, studentRows] = await Promise.all([
    showAthlete
      ? prisma.athleteProgramConnection.findMany({
          where: {
            userId,
            status: AthleteConnectionStatus.APPROVED,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            university: { select: { name: true, state: true } },
          },
        })
      : Promise.resolve([]),
    showStudent
      ? prisma.studentUniversityConnection.findMany({
          where: {
            userId,
            status: StudentConnectionStatus.APPROVED,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            university: { select: { name: true, state: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // Merge into a single list, sort by recency, cap at `limit`. Both row
  // shapes are normalized into UnifiedConnection so the render block
  // doesn't need to branch on kind for the common fields.
  const merged: UnifiedConnection[] = [
    ...athleteRows.map((r) => ({
      id: `a:${r.id}`,
      kind: "athlete" as const,
      typeLabel: ATHLETE_TYPE_LABELS[r.connectionType],
      universityName: r.university.name,
      universityState: r.university.state,
      sport: r.sport,
      startYear: r.startYear,
      endYear: r.endYear,
      createdAt: r.createdAt,
    })),
    ...studentRows.map((r) => ({
      id: `s:${r.id}`,
      kind: "student" as const,
      typeLabel: STUDENT_TYPE_LABELS[r.connectionType],
      universityName: r.university.name,
      universityState: r.university.state,
      sport: null,
      startYear: r.startYear,
      endYear: r.endYear,
      createdAt: r.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  return (
    <section
      aria-labelledby="my-connections-heading"
      className="card p-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="my-connections-heading"
          className={compact ? "text-base font-semibold" : "text-lg font-semibold"}
        >
          My Connections
        </h2>
        <Link
          href="/connections"
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          Manage connections →
        </Link>
      </header>

      {!compact && (
        <p className="mt-1 text-sm text-slate-600">
          Approved school and program affiliations on your account.
        </p>
      )}

      {merged.length === 0 ? (
        // Empty state copy is the literal string from the product brief.
        // The CTA reuses the existing /connections page so we never
        // duplicate the connection submission flow.
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          <p>You don&apos;t have any active connections yet.</p>
          <Link
            href="/connections"
            className="mt-3 inline-flex btn-primary text-xs"
          >
            Add a connection
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
          {merged.map((c) => {
            const years = formatYears(c.startYear, c.endYear);
            const subtitleParts = [
              c.typeLabel,
              c.sport ? `${c.sport}` : null,
              years,
            ].filter(Boolean) as string[];

            return (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {c.universityName}
                    {c.universityState && (
                      <span className="ml-1 text-xs font-normal text-slate-500">
                        · {c.universityState}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-600">
                    {subtitleParts.join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="badge bg-emerald-100 text-emerald-800">
                    Approved
                  </span>
                  {!compact && (
                    <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                      {formatDate(c.createdAt)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
