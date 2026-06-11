"use client";

/**
 * Client-only DMCA forms. Toggle at the top switches between Takedown
 * and Counter-Notice modes. Each form enforces every statutorily
 * required field client-side BEFORE submit — the API re-validates
 * server-side as the source of truth, but failing fast on the client
 * is better UX.
 *
 * Submit state machine:
 *   idle → submitting → (success | error) → reset on mode change
 */
import { useState } from "react";

type Mode = "TAKEDOWN" | "COUNTER_NOTICE";

interface ApiError {
  error: string;
  details?: unknown;
}

export function DmcaForms() {
  const [mode, setMode] = useState<Mode>("TAKEDOWN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  function reset() {
    setError(null);
    setDoneId(null);
  }

  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setDoneId(null);
    const res = await fetch("/api/dmca/notice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as ApiError;
      setError(j.error ?? "Submission failed.");
      return;
    }
    const j = (await res.json()) as { id: string };
    setDoneId(j.id);
  }

  if (doneId) {
    return (
      <div className="card border-emerald-300 bg-emerald-50 p-6 text-emerald-900">
        <h2 className="text-lg font-bold">Notice received</h2>
        <p className="mt-2 text-sm">
          We&rsquo;ve logged your{" "}
          {mode === "TAKEDOWN" ? "takedown notice" : "counter-notice"} (ID{" "}
          <code className="rounded bg-emerald-100 px-1 py-0.5 text-[11px]">
            {doneId}
          </code>
          ) and forwarded it to our review team.
        </p>
        <p className="mt-2 text-xs">
          {mode === "TAKEDOWN"
            ? "We aim to action valid takedown notices within 24-48 hours. You'll receive an email at the address you provided once we've made a decision."
            : "By federal law, we must wait 10-14 business days before restoring removed content so the original complainant can pursue legal action. If they don't, we'll restore the content and email you."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="btn-secondary mt-4 text-sm"
        >
          File another notice
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setMode("TAKEDOWN");
            reset();
          }}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
            mode === "TAKEDOWN"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Takedown Notice
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("COUNTER_NOTICE");
            reset();
          }}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
            mode === "COUNTER_NOTICE"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Counter-Notice
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6">
        {mode === "TAKEDOWN" ? (
          <TakedownForm busy={busy} onSubmit={submit} />
        ) : (
          <CounterForm busy={busy} onSubmit={submit} />
        )}
      </div>
    </div>
  );
}

// -------- Takedown form --------

function TakedownForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    copyrightedWork: "",
    infringingUrl: "",
    signature: "",
    goodFaithStatement: false,
    perjuryStatement: false,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Per-field validation messages. Computed every render so the
  // submit-block hint always reflects current input. Previously the
  // submit button just stayed disabled with no explanation — users
  // had no way to tell which field was failing.
  const missing: string[] = [];
  if (form.fullName.trim().length < 2) missing.push("Full legal name");
  if (form.email.trim().length === 0) missing.push("Email");
  if (form.address.trim().length < 10) missing.push("Mailing address (10+ chars)");
  if (form.copyrightedWork.trim().length < 10) missing.push("Copyrighted work (10+ chars)");
  if (form.infringingUrl.trim().length === 0) missing.push("Infringing URL");
  if (form.signature.trim().length < 2) missing.push("Signature");
  if (!form.goodFaithStatement) missing.push("Good-faith statement checkbox");
  if (!form.perjuryStatement) missing.push("Penalty-of-perjury checkbox");

  const canSubmit = missing.length === 0 && !busy;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    void onSubmit({
      kind: "TAKEDOWN",
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      address: form.address.trim(),
      copyrightedWork: form.copyrightedWork.trim(),
      infringingUrl: form.infringingUrl.trim(),
      signature: form.signature.trim(),
      goodFaithStatement: form.goodFaithStatement,
      perjuryStatement: form.perjuryStatement,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Section title="Your information">
        <TextField label="Full legal name" value={form.fullName} onChange={(v) => update("fullName", v)} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
          <TextField label="Phone (optional)" value={form.phone} onChange={(v) => update("phone", v)} />
        </div>
        <TextAreaField
          label="Mailing address"
          value={form.address}
          onChange={(v) => update("address", v)}
          rows={2}
          required
        />
      </Section>

      <Section title="The copyrighted work">
        <TextAreaField
          label="Identify the copyrighted work being infringed"
          value={form.copyrightedWork}
          onChange={(v) => update("copyrightedWork", v)}
          rows={3}
          required
          hint="Describe the work — title, registration number if any, or a clear description (e.g., 'professional photograph of Coach X taken 2024')."
        />
        <TextField
          label="URL on this site where the infringing material appears"
          value={form.infringingUrl}
          onChange={(v) => update("infringingUrl", v)}
          required
          hint="Full URL, e.g. https://myuniversityverified.com/coach/abc123"
          placeholder="https://myuniversityverified.com/..."
        />
      </Section>

      <Section title="Sworn statements">
        <CheckboxField
          checked={form.goodFaithStatement}
          onChange={(v) => update("goodFaithStatement", v)}
          label='I have a good-faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.'
        />
        <CheckboxField
          checked={form.perjuryStatement}
          onChange={(v) => update("perjuryStatement", v)}
          label="Under penalty of perjury, I state that the information in this notice is accurate, and I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed."
        />
        <TextField
          label="Signature (type your full legal name)"
          value={form.signature}
          onChange={(v) => update("signature", v)}
          required
        />
      </Section>

      <SubmitRow
        disabled={!canSubmit}
        busy={busy}
        label="Submit Takedown Notice"
        missing={missing}
      />
    </form>
  );
}

// -------- Counter-notice form --------

function CounterForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    removedContentDescription: "",
    parentNoticeId: "",
    signature: "",
    perjuryStatement: false,
    consentToJurisdiction: false,
    acceptServiceOfProcess: false,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const missing: string[] = [];
  if (form.fullName.trim().length < 2) missing.push("Full legal name");
  if (form.email.trim().length === 0) missing.push("Email");
  if (form.address.trim().length < 10) missing.push("Mailing address (10+ chars)");
  if (form.removedContentDescription.trim().length < 10)
    missing.push("Removed content description (10+ chars)");
  if (form.signature.trim().length < 2) missing.push("Signature");
  if (!form.perjuryStatement) missing.push("Penalty-of-perjury checkbox");
  if (!form.consentToJurisdiction) missing.push("Consent to jurisdiction checkbox");
  if (!form.acceptServiceOfProcess) missing.push("Accept service of process checkbox");

  const canSubmit = missing.length === 0 && !busy;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    void onSubmit({
      kind: "COUNTER_NOTICE",
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      address: form.address.trim(),
      removedContentDescription: form.removedContentDescription.trim(),
      parentNoticeId: form.parentNoticeId.trim() || undefined,
      signature: form.signature.trim(),
      perjuryStatement: form.perjuryStatement,
      consentToJurisdiction: form.consentToJurisdiction,
      acceptServiceOfProcess: form.acceptServiceOfProcess,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Section title="Your information">
        <TextField label="Full legal name" value={form.fullName} onChange={(v) => update("fullName", v)} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
          <TextField label="Phone (optional)" value={form.phone} onChange={(v) => update("phone", v)} />
        </div>
        <TextAreaField
          label="Mailing address"
          value={form.address}
          onChange={(v) => update("address", v)}
          rows={2}
          required
          hint="Your address determines the federal district court of jurisdiction for any resulting lawsuit."
        />
      </Section>

      <Section title="The removed content">
        <TextAreaField
          label="Identify the material that was removed and where it appeared"
          value={form.removedContentDescription}
          onChange={(v) => update("removedContentDescription", v)}
          rows={3}
          required
          hint="E.g. 'My review of Coach Smith at https://myuniversityverified.com/coach/abc123, removed on Nov 15, 2026.'"
        />
        <TextField
          label="Original takedown notice ID (optional)"
          value={form.parentNoticeId}
          onChange={(v) => update("parentNoticeId", v)}
          hint="If we sent you a notification that included a notice ID, paste it here. Skip if you don't have it."
        />
      </Section>

      <Section title="Sworn statements">
        <CheckboxField
          checked={form.perjuryStatement}
          onChange={(v) => update("perjuryStatement", v)}
          label="Under penalty of perjury, I have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification."
        />
        <CheckboxField
          checked={form.consentToJurisdiction}
          onChange={(v) => update("consentToJurisdiction", v)}
          label="I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located (or, if outside the United States, any judicial district in which MyUniversityVerified may be found)."
        />
        <CheckboxField
          checked={form.acceptServiceOfProcess}
          onChange={(v) => update("acceptServiceOfProcess", v)}
          label="I will accept service of process from the party who submitted the original takedown notice, or that party's agent."
        />
        <TextField
          label="Signature (type your full legal name)"
          value={form.signature}
          onChange={(v) => update("signature", v)}
          required
        />
      </Section>

      <SubmitRow
        disabled={!canSubmit}
        busy={busy}
        label="Submit Counter-Notice"
        missing={missing}
      />
    </form>
  );
}

// -------- Shared building blocks --------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card space-y-3 p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </label>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span className="text-xs text-slate-700">{label}</span>
    </label>
  );
}

function SubmitRow({
  disabled,
  busy,
  label,
  missing,
}: {
  disabled: boolean;
  busy: boolean;
  label: string;
  /** List of human-readable field names that are still failing
   *  validation. Surfaced above the button so users see exactly what's
   *  blocking submit instead of staring at a dead button. */
  missing: string[];
}) {
  // Only show the hint when the button is actually disabled due to
  // missing fields — not while we're in flight (busy). Avoids a flash
  // of "missing X" copy right when the request is mid-submit.
  const showHint = disabled && !busy && missing.length > 0;
  return (
    <div className="flex flex-col items-end gap-2">
      {showHint && (
        <div className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">Fill in or check the following to submit:</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="submit"
        disabled={disabled}
        className="btn-primary text-sm disabled:opacity-50"
      >
        {busy ? "Submitting…" : label}
      </button>
    </div>
  );
}
