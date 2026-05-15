"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProofPreview } from "@/components/admin/ProofPreview";
import { VerificationScorecard } from "@/components/admin/VerificationScorecard";
import { scoreVerification } from "@/lib/verification-confidence";
import { VerificationMethod } from "@prisma/client";

interface VRequest {
  id: string;
  method: string;
  targetRole: string;
  attemptNumber: number;
  status: string;
  confidenceScore?: number | null;
  schoolEmailVerified?: boolean;
  eduEmail?: string | null;
  rosterUrl?: string | null;
  proofUrl?: string | null;
  sport?: string | null;
  universityName?: string | null;
  studentIdUrl?: string | null;
  rosterScreenshotUrl?: string | null;
  linkedinUrl?: string | null;
  hudlUrl?: string | null;
  recruitingProfileUrl?: string | null;
  schoolDirectoryUrl?: string | null;
  gradYear?: number | null;
  playingYears?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  user: { id: string; name: string | null; email: string; role: string; sport: string | null };
}

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  HIGH_CONFIDENCE: "bg-emerald-100 text-emerald-800",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800",
  LOW_CONFIDENCE: "bg-red-100 text-red-800",
  NEEDS_MORE_INFO: "bg-orange-100 text-orange-800",
  APPROVED: "bg-emerald-200 text-emerald-900",
  REJECTED: "bg-red-200 text-red-900",
};

type AdminAction = "approve" | "reject" | "needs_more_info";

const PENDING_LIKE = new Set([
  "PENDING",
  "HIGH_CONFIDENCE",
  "NEEDS_REVIEW",
  "LOW_CONFIDENCE",
  "NEEDS_MORE_INFO",
]);

export function VerificationRow({ request }: { request: VRequest }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reasonOpen, setReasonOpen] = useState<null | "reject" | "needs_more_info">(null);
  const [reason, setReason] = useState(request.rejectionReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(request.status);

  // Re-run the same scorer client-side so the admin sees the live signals
  // even if the persisted score is stale (e.g. an old row from before the
  // scorer existed). Persisted score is preferred for display so refreshing
  // never changes the bucket the queue was sorted by.
  const scored = useMemo(
    () =>
      scoreVerification({
        method: request.method as VerificationMethod,
        userName: request.user.name,
        universityName: request.universityName,
        sport: request.sport,
        rosterUrl: request.rosterUrl,
        proofUrl: request.proofUrl,
        studentIdUrl: request.studentIdUrl,
        rosterScreenshotUrl: request.rosterScreenshotUrl,
        linkedinUrl: request.linkedinUrl,
        hudlUrl: request.hudlUrl,
        recruitingProfileUrl: request.recruitingProfileUrl,
        schoolDirectoryUrl: request.schoolDirectoryUrl,
        eduEmail: request.eduEmail,
        schoolEmailVerified: !!request.schoolEmailVerified,
      }),
    [request]
  );

  async function act(action: AdminAction) {
    if ((action === "reject" || action === "needs_more_info") && reasonOpen !== action && !reason.trim()) {
      // First click on either non-approve action expands its reason field.
      setReasonOpen(action);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/verifications/${request.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        rejectionReason: action !== "approve" ? reason.trim() || undefined : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Could not update.");
      return;
    }
    const j = await res.json().catch(() => ({}));
    setLocalStatus(typeof j.status === "string" ? j.status : action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "NEEDS_MORE_INFO");
    router.refresh();
  }

  const canAct = PENDING_LIKE.has(localStatus);

  // Upgrade requests target a different role than the user currently
  // holds (the recruit → athlete bridge). Surface this prominently so the
  // admin doesn't action it as a fresh verification — approving promotes
  // the user's role AND auto-creates an APPROVED insider connection.
  const isUpgrade =
    request.targetRole.toUpperCase() !== request.user.role.toUpperCase();

  return (
    <div className="card p-4">
      {isUpgrade && (
        <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          <strong>Role upgrade request:</strong>{" "}
          {request.user.role.replace(/_/g, " ").toLowerCase()} →{" "}
          {request.targetRole.replace(/_/g, " ").toLowerCase()}. Approving will
          flip this user's role and auto-create an APPROVED insider connection
          at <strong>{request.universityName ?? "the named school"}</strong>
          {request.sport ? ` (${request.sport})` : ""}. Their prior recruit
          reviews and RECRUITED_BY connections stay attached to the same
          account.
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-slate-500">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {request.user.name ?? request.user.email}
          </div>
          <div className="mt-0.5">
            {request.user.email} · current role {request.user.role.toLowerCase()}
            {request.user.sport ? ` · ${request.user.sport}` : ""}
            {isUpgrade && (
              <>
                {" · target "}
                <strong className="text-indigo-700">
                  {request.targetRole.replace(/_/g, " ").toLowerCase()}
                </strong>
              </>
            )}
            {request.attemptNumber > 1 && ` · attempt ${request.attemptNumber}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[localStatus] ?? "bg-slate-100 text-slate-700"}`}
          >
            {localStatus.replace(/_/g, " ").toLowerCase()}
          </span>
          {typeof request.confidenceScore === "number" && (
            <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
              score {request.confidenceScore}
            </span>
          )}
          <span>{new Date(request.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <Cell label="Wants" value={request.targetRole.replace("_", " ").toLowerCase()} />
        <Cell label="Method" value={request.method.replace("_", " ").toLowerCase()} />
        {request.universityName && <Cell label="School" value={request.universityName} />}
        {request.sport && <Cell label="Sport" value={request.sport} />}
        {request.gradYear && <Cell label="Grad year" value={String(request.gradYear)} />}
        {request.playingYears && <Cell label="Playing years" value={request.playingYears} />}
        {request.eduEmail && (
          <Cell
            label=".edu email"
            value={
              request.schoolEmailVerified
                ? `${request.eduEmail} ✓`
                : request.eduEmail
            }
          />
        )}
      </dl>

      {/* Auto-confidence scorecard — sorted-by signal at submit time. */}
      <div className="mt-3">
        <VerificationScorecard
          score={request.confidenceScore ?? scored.score}
          bucket={localStatus}
          signals={scored.signals}
        />
      </div>

      {(request.rosterUrl || request.studentIdUrl || request.rosterScreenshotUrl || request.proofUrl) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {request.rosterUrl && <ProofPreview label="Roster URL" url={request.rosterUrl} />}
          {request.studentIdUrl && <ProofPreview label="Student ID / alumni doc" url={request.studentIdUrl} />}
          {request.rosterScreenshotUrl && (
            <ProofPreview label="Roster screenshot" url={request.rosterScreenshotUrl} />
          )}
          {request.proofUrl && <ProofPreview label="Other proof" url={request.proofUrl} />}
        </div>
      )}

      {(request.linkedinUrl || request.hudlUrl || request.recruitingProfileUrl || request.schoolDirectoryUrl) && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            External profiles
          </h4>
          <ul className="mt-1.5 space-y-0.5 text-[11px]">
            {request.linkedinUrl && <ExternalLi label="LinkedIn" url={request.linkedinUrl} />}
            {request.hudlUrl && <ExternalLi label="Hudl" url={request.hudlUrl} />}
            {request.recruitingProfileUrl && (
              <ExternalLi label="Recruiting profile" url={request.recruitingProfileUrl} />
            )}
            {request.schoolDirectoryUrl && (
              <ExternalLi label="School directory" url={request.schoolDirectoryUrl} />
            )}
          </ul>
        </div>
      )}

      {request.notes && (
        <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
          <strong className="text-slate-700">Notes:</strong> {request.notes}
        </p>
      )}

      {request.rejectionReason && (localStatus === "REJECTED" || localStatus === "NEEDS_MORE_INFO") && (
        <p
          className={`mt-3 rounded-lg p-2 text-xs ${
            localStatus === "REJECTED" ? "bg-red-50 text-red-800" : "bg-orange-50 text-orange-800"
          }`}
        >
          <strong>{localStatus === "REJECTED" ? "Rejection reason" : "Admin note"}:</strong>{" "}
          {request.rejectionReason}
        </p>
      )}

      {canAct && (
        <>
          {reasonOpen && (
            <div className="mt-3">
              <label className="label">
                {reasonOpen === "reject" ? "Rejection reason" : "What more info do you need?"}
              </label>
              <textarea
                className="input min-h-[64px]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder={
                  reasonOpen === "reject"
                    ? "Why is this being rejected? Shown to the user."
                    : "Tell the user what to add — e.g. an official roster URL, a clearer ID photo."
                }
              />
            </div>
          )}
          {error && <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => act("approve")}
              disabled={busy}
              className="btn-primary text-xs"
            >
              {busy ? "Working…" : "Approve"}
            </button>
            <button
              onClick={() => act("needs_more_info")}
              disabled={busy}
              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {reasonOpen === "needs_more_info" ? "Send request" : "Needs more info…"}
            </button>
            <button
              onClick={() => act("reject")}
              disabled={busy}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {reasonOpen === "reject" ? "Confirm reject" : "Reject…"}
            </button>
            {reasonOpen && (
              <button
                type="button"
                onClick={() => {
                  setReasonOpen(null);
                  setReason("");
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                cancel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="truncate text-slate-800">{value}</dd>
    </div>
  );
}

function ExternalLi({ label, url }: { label: string; url: string }) {
  return (
    <li>
      <span className="font-medium text-slate-700">{label}:</span>{" "}
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-brand-700 underline break-all"
      >
        {url.length > 80 ? url.slice(0, 80) + "…" : url}
      </a>
    </li>
  );
}
