"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initial: string[];
}

const MAX_EMAILS = 5;

/**
 * Master-only client form for editing the recovery email list. Supports
 * adding, removing, and saving. Validation is conservative — basic email
 * shape + de-dupe; the server re-validates as well.
 */
export function RecoveryEmailsForm({ initial }: Props) {
  const router = useRouter();
  const [emails, setEmails] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function addDraft() {
    const e = draft.trim().toLowerCase();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError("Doesn't look like a valid email.");
      return;
    }
    if (emails.includes(e)) {
      setError("Already in the list.");
      return;
    }
    if (emails.length >= MAX_EMAILS) {
      setError(`Up to ${MAX_EMAILS} recovery emails.`);
      return;
    }
    setEmails((prev) => [...prev, e]);
    setDraft("");
    setError(null);
  }

  function remove(idx: number) {
    setEmails((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings/recovery-emails", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Failed to save.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {emails.length === 0 ? (
          <li className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
            No recovery emails yet.
          </li>
        ) : (
          emails.map((e, i) => (
            <li
              key={e}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm"
            >
              <span className="font-mono text-xs">{e}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="flex gap-2">
        <input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="recovery@example.com"
          className="input flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
        />
        <button type="button" onClick={addDraft} className="btn-secondary">
          Add
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
          {message}
        </div>
      )}

      <button type="button" onClick={save} disabled={busy} className="btn-primary">
        {busy ? "Saving…" : "Save recovery emails"}
      </button>
    </div>
  );
}
