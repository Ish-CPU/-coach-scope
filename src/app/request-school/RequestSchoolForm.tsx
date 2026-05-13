"use client";

import { useState } from "react";
import type { DivisionOption } from "@/lib/division";

interface Props {
  sports: string[];
  divisions: DivisionOption[];
  initialSchoolName?: string;
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; duplicate: boolean; message: string }
  | { kind: "error"; message: string };

const REQUESTER_ROLES = ["Athlete", "Parent", "Student", "Coach", "Other"];

export function RequestSchoolForm({ sports, divisions, initialSchoolName }: Props) {
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });

    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      if (typeof v === "string" && v.trim() !== "") payload[k] = v.trim();
    }

    try {
      const res = await fetch("/api/requests/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          kind: "error",
          message:
            typeof json.error === "string"
              ? json.error
              : "Couldn't submit. Please check the form and try again.",
        });
        return;
      }
      setState({
        kind: "success",
        duplicate: Boolean(json.duplicate),
        message:
          typeof json.message === "string"
            ? json.message
            : "Thanks — we'll add this to the import queue.",
      });
      e.currentTarget.reset();
    } catch {
      setState({
        kind: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 00-1.4-1.4L8 11.1 4.7 7.8a1 1 0 10-1.4 1.4l4 4a1 1 0 001.4 0l8-8z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">
          {state.duplicate ? "Already on our list" : "Request received"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{state.message}</p>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="btn-secondary mt-4"
        >
          Submit another
        </button>
      </div>
    );
  }

  const submitting = state.kind === "submitting";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="School name" required>
        <input
          name="schoolName"
          required
          maxLength={200}
          defaultValue={initialSchoolName ?? ""}
          className="input"
          placeholder="e.g. University of Wisconsin-Madison"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sport" required>
          <select name="sport" required className="input" defaultValue="">
            <option value="" disabled>
              Select a sport
            </option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Division / Level">
          <select name="division" className="input" defaultValue="">
            <option value="">Unsure</option>
            {divisions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Conference">
          <input
            name="conference"
            maxLength={200}
            className="input"
            placeholder="e.g. Big Ten"
          />
        </Field>
        <Field label="State">
          <input
            name="state"
            maxLength={40}
            className="input"
            placeholder="e.g. WI"
          />
        </Field>
      </div>

      <Field label="Athletics website URL">
        <input
          name="athleticsUrl"
          type="url"
          maxLength={500}
          className="input"
          placeholder="https://uwbadgers.com"
        />
      </Field>

      <Field label="Roster URL">
        <input
          name="rosterUrl"
          type="url"
          maxLength={500}
          className="input"
          placeholder="https://uwbadgers.com/sports/baseball/roster"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your role">
          <select name="requesterRole" className="input" defaultValue="">
            <option value="">Prefer not to say</option>
            {REQUESTER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Your email (optional)">
          <input
            name="requesterEmail"
            type="email"
            maxLength={200}
            className="input"
            placeholder="So we can let you know it's live"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={4}
          maxLength={2000}
          className="input"
          placeholder="Anything that helps us add this faster — head coach name, a roster page link, etc."
        />
      </Field>

      {state.kind === "error" && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
