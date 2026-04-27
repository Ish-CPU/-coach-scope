"use client";

import { useState } from "react";

interface VRequest {
  id: string;
  method: string;
  targetRole: string;
  attemptNumber: number;
  eduEmail?: string | null;
  rosterUrl?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; role: string; sport: string | null };
}

export function VerificationRow({ request }: { request: VRequest }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    const res = await fetch(`/api/admin/verifications/${request.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (res.ok) setDone(true);
  }

  if (done) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div>
          {request.user.email} · current role {request.user.role.toLowerCase()}
          {request.user.sport ? ` · ${request.user.sport}` : ""}
          {request.attemptNumber > 1 && ` · attempt ${request.attemptNumber}`}
        </div>
        <div>{new Date(request.createdAt).toLocaleString()}</div>
      </div>
      <div className="mt-2 grid gap-1 text-sm">
        <div><strong>Wants:</strong> {request.targetRole.replace("_", " ").toLowerCase()}</div>
        <div><strong>Method:</strong> {request.method.replace("_", " ").toLowerCase()}</div>
        {request.eduEmail && <div><strong>.edu email:</strong> {request.eduEmail}</div>}
        {request.rosterUrl && (
          <div>
            <strong>Roster:</strong>{" "}
            <a className="text-brand-700 underline" href={request.rosterUrl} target="_blank" rel="noreferrer">
              {request.rosterUrl}
            </a>
          </div>
        )}
        {request.proofUrl && (
          <div>
            <strong>Proof:</strong>{" "}
            <a className="text-brand-700 underline" href={request.proofUrl} target="_blank" rel="noreferrer">
              {request.proofUrl}
            </a>
          </div>
        )}
        {request.notes && <div className="text-slate-600">Notes: {request.notes}</div>}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => act("approve")} disabled={busy} className="btn-primary text-xs">Approve</button>
        <button onClick={() => act("reject")} disabled={busy} className="btn text-xs bg-red-600 text-white hover:bg-red-700">Reject</button>
      </div>
    </div>
  );
}
