import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConnectionRow, type ConnectionDisplay } from "@/components/admin/ConnectionRow";
import {
  AthleteConnectionStatus,
  StudentConnectionStatus,
} from "@prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { kind?: string; status?: string };
}

const KIND_TABS = [
  { value: "athlete", label: "Athlete connections" },
  { value: "student", label: "Student connections" },
] as const;

const STATUS_TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
] as const;

type KindFilter = "athlete" | "student";

function parseKind(raw: string | undefined): KindFilter {
  return raw === "student" ? "student" : "athlete";
}

function parseStatus(raw: string | undefined): "PENDING" | "APPROVED" | "REJECTED" | "ALL" {
  if (raw === "APPROVED" || raw === "REJECTED" || raw === "PENDING" || raw === "ALL") return raw;
  return "PENDING";
}

export default async function AdminConnectionsPage({ searchParams }: PageProps) {
  const kind = parseKind(searchParams.kind);
  const status = parseStatus(searchParams.status);

  const where = (() => {
    if (status === "ALL") return {};
    return { status };
  })();

  // Pull both queues for the tab counts; only the active one is rendered.
  const [athletePendingCount, studentPendingCount, rows] = await Promise.all([
    prisma.athleteProgramConnection.count({ where: { status: AthleteConnectionStatus.PENDING } }),
    prisma.studentUniversityConnection.count({ where: { status: StudentConnectionStatus.PENDING } }),
    kind === "athlete"
      ? prisma.athleteProgramConnection.findMany({
          where: where as any,
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            user: { select: { id: true, name: true, email: true } },
            university: { select: { id: true, name: true, state: true } },
            school: { select: { id: true, sport: true } },
          },
        })
      : prisma.studentUniversityConnection.findMany({
          where: where as any,
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            user: { select: { id: true, name: true, email: true } },
            university: { select: { id: true, name: true, state: true } },
          },
        }),
  ]);

  const display: ConnectionDisplay[] =
    kind === "athlete"
      ? (rows as any[]).map((r) => ({
          id: r.id,
          kind: "athlete",
          user: r.user,
          university: r.university,
          status: r.status,
          connectionType: r.connectionType,
          sport: r.sport,
          schoolSport: r.school?.sport ?? null,
          rosterUrl: r.rosterUrl,
          recruitingProofUrl: r.recruitingProofUrl,
          startYear: r.startYear,
          endYear: r.endYear,
          notes: r.notes,
          rejectionReason: r.rejectionReason,
          createdAt: r.createdAt.toISOString(),
        }))
      : (rows as any[]).map((r) => ({
          id: r.id,
          kind: "student",
          user: r.user,
          university: r.university,
          status: r.status,
          connectionType: r.connectionType,
          schoolEmail: r.schoolEmail,
          studentIdUrl: r.studentIdUrl,
          proofUrl: r.proofUrl,
          startYear: r.startYear,
          endYear: r.endYear,
          notes: r.notes,
          rejectionReason: r.rejectionReason,
          createdAt: r.createdAt.toISOString(),
        }));

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold text-slate-900">Athlete &amp; student connections</h1>
      <p className="mt-1 text-sm text-slate-600">
        Approving a connection unlocks per-target review permissions automatically — no
        role change. Approving an athlete CURRENT_ATHLETE row, for instance, lets that
        user post coach reviews for that program.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {KIND_TABS.map((t) => {
          const pending =
            t.value === "athlete" ? athletePendingCount : studentPendingCount;
          const active = kind === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/connections?kind=${t.value}&status=${status}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
              {pending > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/30 text-white" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const active = status === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/connections?kind=${kind}&status=${t.value}`}
              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 space-y-3">
        {display.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">Nothing in this queue.</div>
        ) : (
          display.map((row) => <ConnectionRow key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}
