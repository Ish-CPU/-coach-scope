"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UniversityCombobox,
  type UniversityOption,
} from "@/components/shared/UniversityCombobox";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Manual student / student-alumni ID submission flow for users who don't
 * have (or can't use) a school-issued .edu email. Always reviewed by an
 * admin — never auto-approved. Mirrors the structured proof contract used
 * by the athlete verification form so admin review compares the same fields.
 *
 * `alumni` swaps the copy to acknowledge that the uploaded doc may be a
 * diploma / transcript / alumni card rather than an active student ID, and
 * surfaces an optional graduation year so admins can sanity-check the time
 * frame.
 */
export function StudentIdUploadForm({ alumni = false }: { alumni?: boolean }) {
  const router = useRouter();
  // Combobox state — `universityId` is the structured FK, `universityName`
  // mirrors the display string the existing API + admin scorecard expect.
  // Students do NOT pick a sport / program; only the university matters.
  const [universityName, setUniversityName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [studentIdUrl, setStudentIdUrl] = useState("");
  const [gradYear, setGradYear] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "PROOF_UPLOAD",
        universityName,
        universityId: universityId || undefined,
        studentIdUrl,
        // Re-use proofUrl as the canonical "image to review" pointer so the
        // existing admin review UI keeps rendering it without changes.
        proofUrl: studentIdUrl,
        gradYear: alumni && gradYear ? Number(gradYear) : undefined,
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

  const idLabel = alumni ? "Student ID / alumni documentation URL" : "Student ID URL";
  const idHelp = alumni
    ? "Link to a hosted image of your former student ID, alumni card, diploma, or transcript."
    : "File upload coming soon — for now paste a public link to a hosted image of your ID.";

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div>
        <h3 className="text-sm font-semibold">
          {alumni ? "Alumni documentation upload" : "Student ID upload"}
        </h3>
        <p className="text-xs text-slate-500">
          Manual review by an admin. Never auto-approved. Edited, AI-generated, or unclear
          images are rejected.
        </p>
      </div>
      <UniversityCombobox
        label="School / university"
        value={universityId}
        onChange={(id, u: UniversityOption | null) => {
          setUniversityId(id);
          setUniversityName(u?.name ?? "");
        }}
        required
      />
      <div>
        <label className="label">{idLabel}</label>
        <input
          className="input"
          type="url"
          required
          value={studentIdUrl}
          onChange={(e) => setStudentIdUrl(e.target.value)}
          placeholder="https://…"
        />
        <p className="mt-1 text-xs text-slate-500">{idHelp}</p>
      </div>
      {alumni && (
        <div>
          <label className="label">Graduation year <span className="text-slate-400">(optional)</span></label>
          <input
            className="input"
            type="number"
            min={1950}
            max={CURRENT_YEAR + 1}
            value={gradYear}
            onChange={(e) => setGradYear(e.target.value)}
            placeholder="e.g. 2019"
          />
        </div>
      )}
      <div>
        <label className="label">Notes (optional)</label>
        <textarea
          className="input min-h-[72px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Anything that helps the admin verify."
        />
      </div>
      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
