"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EmailCodeVerificationForm({
  requireEdu,
  purposeLabel,
}: {
  requireEdu?: boolean;
  purposeLabel: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"request" | "confirm">("request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await fetch("/api/verification/code/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Could not send code.");
      return;
    }
    setPhase("confirm");
    setInfo(
      j.devCode
        ? `Code sent. (Dev: ${j.devCode}) Expires in ${j.expiresInMinutes} min.`
        : `Code sent to ${email}. It expires in ${j.expiresInMinutes} minutes.`
    );
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/verification/code/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Could not verify.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{purposeLabel}</h3>
        {requireEdu && (
          <p className="text-xs text-slate-500">
            Use your school-issued <strong>.edu</strong> email. We'll send a 6-digit code.
          </p>
        )}
      </div>

      {phase === "request" ? (
        <form onSubmit={requestCode} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={requireEdu ? "you@university.edu" : "you@example.com"}
            />
          </div>
          {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <button className="btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-3">
          {info && <div className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{info}</div>}
          <div>
            <label className="label">6-digit code</label>
            <input
              className="input tracking-[0.5em] text-center text-lg"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
          </div>
          {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="btn-ghost text-xs" onClick={() => setPhase("request")}>
              Use a different email
            </button>
            <button className="btn-primary" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Confirm code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
