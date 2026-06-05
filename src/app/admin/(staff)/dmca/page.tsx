/**
 * Admin DMCA queue. Master-admin only — DMCA disposition has personal
 * liability implications, so we don't delegate to staff admins by
 * default. The action endpoint enforces this independently.
 *
 * Tabs cycle through PENDING (default), CONTENT_REMOVED, COUNTER_RECEIVED,
 * RESTORED, REJECTED, and ALL. The counter-notice waiting-period date
 * is shown inline so the admin knows when content becomes
 * restoration-eligible without doing date math.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/permissions";
import { isMasterAdmin } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import { DmcaNoticeKind, DmcaNoticeStatus } from "@prisma/client";
import { DmcaActions } from "./DmcaActions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const TABS: { label: string; value: DmcaNoticeStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Removed", value: "CONTENT_REMOVED" },
  { label: "Counter received", value: "COUNTER_RECEIVED" },
  { label: "Restored", value: "CONTENT_RESTORED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "ALL" },
];

function parseStatus(raw: string | undefined): DmcaNoticeStatus | null {
  const values: DmcaNoticeStatus[] = [
    "PENDING",
    "CONTENT_REMOVED",
    "COUNTER_RECEIVED",
    "CONTENT_RESTORED",
    "REJECTED",
  ];
  return values.find((v) => v === raw) ?? null;
}

export default async function AdminDmcaPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  // Master-only gate (consistent with the action endpoint).
  if (!isMasterAdmin(session)) redirect("/admin");

  const statusFilter = parseStatus(searchParams.status);
  const showAll = searchParams.status === "ALL";
  const where = statusFilter
    ? { status: statusFilter }
    : showAll
    ? {}
    : { status: DmcaNoticeStatus.PENDING };

  const rows = await safe(
    () =>
      prisma.dmcaNotice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    [],
    "admin:dmca:list"
  );

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold">DMCA notices</h1>
      <p className="mt-1 text-sm text-slate-600">
        Takedowns and counter-notices filed via{" "}
        <Link href="/dmca" className="text-brand-700 underline">
          /dmca
        </Link>
        . Master admin only. <span className="font-semibold">Act on
        takedowns within 24-48 hours</span> to preserve safe harbor.
        Counter-notices have a 10-14 day waiting period before content
        can be restored.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active =
            (statusFilter === t.value) ||
            (!statusFilter && t.value === "PENDING" && !showAll) ||
            (showAll && t.value === "ALL");
          return (
            <a
              key={t.value}
              href={`/admin/dmca?status=${t.value}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-6 space-y-4">
        {rows.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">
            Nothing in this queue.
          </div>
        ) : (
          rows.map((n) => (
            <article key={n.id} className="card p-5">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">
                    {n.kind === DmcaNoticeKind.TAKEDOWN
                      ? "Takedown Notice"
                      : "Counter-Notice"}{" "}
                    <StatusPill status={n.status} />
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    ID <code className="rounded bg-slate-100 px-1 py-0.5">{n.id}</code>{" "}
                    · submitted {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </p>
                </div>
                {n.counterEligibleToRestoreAt && n.status === "COUNTER_RECEIVED" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    Eligible to restore: {n.counterEligibleToRestoreAt.toISOString().slice(0, 10)}
                  </span>
                )}
              </header>

              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Submitter
                  </h3>
                  <p className="mt-1 text-slate-900">{n.fullName}</p>
                  <p className="text-xs text-slate-600">{n.email}</p>
                  {n.phone && <p className="text-xs text-slate-600">{n.phone}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{n.address}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Signed: &ldquo;{n.signature}&rdquo;
                    {n.submitterIp && <> · IP {n.submitterIp}</>}
                  </p>
                </div>

                <div>
                  {n.kind === DmcaNoticeKind.TAKEDOWN ? (
                    <>
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Claimed work
                      </h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{n.copyrightedWork}</p>
                      <h3 className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Infringing URL
                      </h3>
                      <a
                        href={n.infringingUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block break-all text-xs text-brand-700 underline"
                      >
                        {n.infringingUrl}
                      </a>
                    </>
                  ) : (
                    <>
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Removed content
                      </h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                        {n.removedContentDescription}
                      </p>
                      {n.parentNoticeId && (
                        <p className="mt-2 text-xs text-slate-500">
                          References takedown:{" "}
                          <code className="rounded bg-slate-100 px-1 py-0.5">
                            {n.parentNoticeId}
                          </code>
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {(n.adminNote || n.actionTaken) && (
                <div className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  {n.adminNote && (
                    <p>
                      <span className="font-semibold">Admin note:</span> {n.adminNote}
                    </p>
                  )}
                  {n.actionTaken && (
                    <p className="mt-1">
                      <span className="font-semibold">Action taken:</span> {n.actionTaken}
                    </p>
                  )}
                </div>
              )}

              {n.status === "PENDING" || n.status === "COUNTER_RECEIVED" ? (
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <DmcaActions
                    id={n.id}
                    kind={n.kind}
                    status={n.status}
                    counterEligibleToRestoreAt={
                      n.counterEligibleToRestoreAt?.toISOString() ?? null
                    }
                  />
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: DmcaNoticeStatus }) {
  const palette: Record<DmcaNoticeStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    CONTENT_REMOVED: "bg-emerald-100 text-emerald-800",
    COUNTER_RECEIVED: "bg-sky-100 text-sky-800",
    CONTENT_RESTORED: "bg-slate-200 text-slate-700",
    REJECTED: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${palette[status]}`}>
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}
