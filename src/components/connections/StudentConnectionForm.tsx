"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StudentConnectionType } from "@prisma/client";
import {
  UniversityCombobox,
  type UniversityOption,
} from "@/components/shared/UniversityCombobox";

const TYPE_LABELS: Record<StudentConnectionType, string> = {
  CURRENT_STUDENT: "Current student",
  STUDENT_ALUMNI: "Alumni / graduated",
  ADMITTED_TO: "Admitted (didn't enroll)",
  TRANSFERRED_FROM: "Transferred from",
  VISITED_CAMPUS: "Visited campus",
};

const CURRENT_YEAR = new Date().getFullYear();

const ADMISSIONS_CONTEXT_TYPES = new Set<StudentConnectionType>([
  StudentConnectionType.ADMITTED_TO,
  StudentConnectionType.VISITED_CAMPUS,
]);

/**
 * Add-a-connection form for students. Always submits as PENDING — admin
 * approval is what unlocks downstream review permissions. Surfaces the
 * insider-vs-admissions distinction so users understand which connection
 * types unlock which review categories.
 *
 * Like the athlete form, the university selector is a live combobox
 * against `/api/universities/search`. Students don't need a sport pick,
 * so universityId alone drives the submission.
 */
export function StudentConnectionForm() {
  const router = useRouter();
  const [universityId, setUniversityId] = useState<string>("");
  const [, setUniversityName] = useState<string>("");
  const [connectionType, setConnectionType] = useState<StudentConnectionType>(
    StudentConnectionType.CURRENT_STUDENT
  );
  const [schoolEmail, setSchoolEmail] = useState("");
  const [studentIdUrl, setStudentIdUrl] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const isAdmissionsContext = ADMISSIONS_CONTEXT_TYPES.has(connectionType);

  function handleUniversityChange(id: string, u: UniversityOption | null) {
    setUniversityId(id);
    setUniversityName(u?.name ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/student-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universityId,
        connectionType,
        schoolEmail: schoolEmail || undefined,
        studentIdUrl: studentIdUrl || undefined,
        proofUrl: proofUrl || undefined,
        startYear: startYear ? Number(startYear) : undefined,
        endYear: endYear ? Number(endYear) : undefined,
        notes: notes || undefined,
      }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Could not submit.");
      return;
    }
    setDone(
      j.updated
        ? "Updated — back to pending review by an admin."
        : "Submitted. An admin will review your connection."
    );
    router.refresh();
  }

  if (done) {
    return (
      <div className="card p-4 text-sm text-emerald-800">
        {done}
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setSchoolEmail("");
            setStudentIdUrl("");
            setProofUrl("");
            setNotes("");
          }}
          className="ml-2 text-xs underline"
        >
          Add another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">Add a school connection</h3>
        <p className="text-xs text-slate-500">
          Submitted as <strong>pending</strong>. An admin reviews each connection — never
          auto-approved. Only approved connections unlock review writing for that school.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <UniversityCombobox
          value={universityId}
          onChange={handleUniversityChange}
          required
        />
        <div>
          <label className="label">Connection type</label>
          <select
            className="input"
            required
            value={connectionType}
            onChange={(e) => setConnectionType(e.target.value as StudentConnectionType)}
          >
            {Object.values(StudentConnectionType).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {isAdmissionsContext
              ? "Admissions context — once approved, unlocks ADMISSIONS reviews only. Does not unlock university or dorm reviews."
              : "Insider connection — once approved, unlocks university and dorm reviews for this school."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">
            School email <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className="input"
            type="email"
            value={schoolEmail}
            onChange={(e) => setSchoolEmail(e.target.value)}
            placeholder="you@university.edu"
          />
        </div>
        <div>
          <label className="label">
            Student ID URL <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className="input"
            type="url"
            value={studentIdUrl}
            onChange={(e) => setStudentIdUrl(e.target.value)}
            placeholder="https://… (link to a hosted image of your ID)"
          />
        </div>
      </div>

      <div>
        <label className="label">
          {isAdmissionsContext ? "Admissions / visit proof URL" : "Other proof URL"}{" "}
          <span className="text-slate-400">(optional)</span>
        </label>
        <input
          className="input"
          type="url"
          value={proofUrl}
          onChange={(e) => setProofUrl(e.target.value)}
          placeholder={
            isAdmissionsContext
              ? "Acceptance letter, tour confirmation email, financial aid letter…"
              : "https://… any supporting evidence (transcript, diploma, etc.)"
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Start year (optional)</label>
          <input
            className="input"
            type="number"
            min={1950}
            max={CURRENT_YEAR + 1}
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            placeholder="e.g. 2020"
          />
        </div>
        <div>
          <label className="label">End year (optional)</label>
          <input
            className="input"
            type="number"
            min={1950}
            max={CURRENT_YEAR + 8}
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
            placeholder="e.g. 2024 — leave blank if current"
          />
        </div>
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <textarea
          className="input min-h-[72px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Anything that helps the admin verify (major, dorm/hall, year of acceptance, etc.)"
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <button className="btn-primary" disabled={busy || !universityId}>
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
