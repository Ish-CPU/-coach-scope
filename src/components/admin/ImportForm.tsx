"use client";

import { useState } from "react";

interface ImportType {
  value: string;
  label: string;
  description: string;
}

interface ImportResult {
  type: string;
  rowsRead: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export function ImportForm({ types }: { types: ImportType[] }) {
  const [type, setType] = useState(types[0]?.value ?? "universities");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Pick a CSV file first.");
      return;
    }
    setError(null);
    setResult(null);
    setBusy(true);
    const fd = new FormData();
    fd.set("type", type);
    fd.set("file", file);
    const res = await fetch("/api/admin/import", { method: "POST", body: fd });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Import failed.");
      return;
    }
    setResult(j as ImportResult);
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4">
      <div>
        <label className="label">Import type</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {types.find((t) => t.value === type)?.description}
        </p>
      </div>

      <div>
        <label className="label">CSV file</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input"
        />
        <p className="mt-1 text-xs text-slate-500">5 MB max. Headers must match the template.</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <button type="submit" className="btn-primary" disabled={busy || !file}>
        {busy ? "Importing…" : "Import CSV"}
      </button>

      {result && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="font-semibold">{result.type}</div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
            <div>read: <strong>{result.rowsRead}</strong></div>
            <div>created: <strong className="text-emerald-700">{result.created}</strong></div>
            <div>updated: <strong className="text-brand-700">{result.updated}</strong></div>
            <div>skipped: <strong className="text-amber-700">{result.skipped}</strong></div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded bg-white p-2 text-xs">
              <div className="font-semibold text-red-700">{result.errors.length} error(s):</div>
              <ul className="mt-1 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
