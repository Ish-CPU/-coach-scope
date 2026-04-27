"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailCodeVerificationForm } from "@/components/verification/EmailCodeVerificationForm";

type Method = "EDU_EMAIL" | "ROSTER_LINK" | "PROOF_UPLOAD";

const TABS: { id: Method; label: string; help: string }[] = [
  {
    id: "EDU_EMAIL",
    label: ".edu Email",
    help: "Fastest path. We'll email you a 6-digit code from your team-issued .edu address.",
  },
  {
    id: "ROSTER_LINK",
    label: "Roster Link",
    help: "Paste a link to your name on an official athletics roster.",
  },
  {
    id: "PROOF_UPLOAD",
    label: "Manual proof",
    help: "Always reviewed by an admin — never auto-approved.",
  },
];

export function AthleteVerificationForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Method>("EDU_EMAIL");
  const [rosterUrl, setRosterUrl] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (disabled) {
    return (
      <div className="card p-4 text-sm text-slate-600">
        You already have a pending request. Sit tight — an admin will review it shortly.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: tab,
        rosterUrl: tab === "ROSTER_LINK" ? rosterUrl : "",
        proofUrl: tab === "PROOF_UPLOAD" ? proofUrl : "",
        notes,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Could not submit.");
      return;
    }
    setDone(j.note ?? "Submitted for review.");
    router.refresh();
  }

  if (done) {
    return <div className="card p-4 text-sm text-emerald-800">{done}</div>;
  }

  return (
    <div className="card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Verified Athlete — choose one method</h3>
        <p className="text-xs text-slate-500">
          Manual uploads always require admin review. Edited or unclear images are rejected.
          Attempts are limited and logged.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className={`rounded-full px-3 py-1 text-sm ${
              tab === t.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">{TABS.find((t) => t.id === tab)!.help}</p>

      {tab === "EDU_EMAIL" && (
        <EmailCodeVerificationForm purposeLabel="Athlete .edu verification" requireEdu />
      )}

      {tab !== "EDU_EMAIL" && (
        <form onSubmit={submit} className="space-y-3">
          {tab === "ROSTER_LINK" && (
            <div>
              <label className="label">Official roster URL</label>
              <input
                className="input"
                type="url"
                required
                value={rosterUrl}
                onChange={(e) => setRosterUrl(e.target.value)}
                placeholder="https://gostanford.com/sports/baseball/roster/..."
              />
              <p className="mt-1 text-xs text-slate-500">
                Must be an official school or athletics domain. Shorteners (bit.ly) and Google Drive links
                are rejected.
              </p>
            </div>
          )}
          {tab === "PROOF_UPLOAD" && (
            <div>
              <label className="label">Proof URL (placeholder)</label>
              <input
                className="input"
                type="url"
                required
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="mt-1 text-xs text-slate-500">
                File upload coming soon. For now paste a link to your supporting document.
                <br />
                <strong>Note:</strong> manual uploads are <em>never</em> auto-approved.
              </p>
            </div>
          )}
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </div>
          {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <button className="btn-primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit for review"}
          </button>
        </form>
      )}
    </div>
  );
}
