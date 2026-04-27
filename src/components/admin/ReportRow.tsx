"use client";

import { useState } from "react";

interface Report {
  id: string;
  reason: string;
  details?: string | null;
  createdAt: string;
  reporter: { id: string; name: string | null; email: string };
  review: {
    id: string;
    title?: string | null;
    body: string;
    overall: number;
    author: { id: string; name: string | null; email: string; role: string };
    coach?: { id: string; name: string } | null;
    university?: { id: string; name: string } | null;
    dorm?: { id: string; name: string } | null;
    school?: { id: string; sport: string; university: { name: string } } | null;
  };
}

export function ReportRow({ report }: { report: Report }) {
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState(false);

  async function act(action: "hide" | "remove" | "dismiss") {
    setBusy(true);
    const res = await fetch(`/api/admin/reports/${report.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (res.ok) setResolved(true);
  }

  if (resolved) return null;

  const target =
    report.review.coach?.name
    ?? report.review.university?.name
    ?? report.review.dorm?.name
    ?? (report.review.school ? `${report.review.school.university.name} ${report.review.school.sport}` : "Unknown");

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Reported {new Date(report.createdAt).toLocaleString()} · by {report.reporter.email}
        </div>
        <div className="text-xs uppercase tracking-wider text-red-600">{report.reason}</div>
      </div>
      <div className="mt-2 text-sm">
        <strong>Target:</strong> {target} · <strong>Author:</strong> {report.review.author.email} ({report.review.author.role})
      </div>
      {report.details && <div className="mt-2 text-sm text-slate-600">Reporter notes: {report.details}</div>}
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
        {report.review.title && <div className="font-medium">{report.review.title}</div>}
        <p className="mt-1 whitespace-pre-line">{report.review.body}</p>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => act("hide")} disabled={busy} className="btn-secondary text-xs">Hide review</button>
        <button onClick={() => act("remove")} disabled={busy} className="btn text-xs bg-red-600 text-white hover:bg-red-700">Remove review</button>
        <button onClick={() => act("dismiss")} disabled={busy} className="btn-ghost text-xs">Dismiss report</button>
      </div>
    </div>
  );
}
