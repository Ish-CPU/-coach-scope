"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UniversityCombobox,
  type UniversityOption,
} from "@/components/shared/UniversityCombobox";
import { ProgramCombobox } from "@/components/shared/ProgramCombobox";

interface Props {
  disabled: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Recruit-specific verification form.
 *
 * Recruits don't have rosters or .edu accounts at the recruiting school —
 * they verify with structured proof of contact. The API enforces the same
 * contract:
 *   - method:               PROOF_UPLOAD (only)
 *   - sport + universityName: required (so admins know what they're vetting)
 *   - at least ONE of:      recruitingProofUrl / recruitingProfileUrl / proofUrl
 *
 * The proof URLs deliberately accept any of the spec's listed types
 * (official visit confirmation, camp invite email, staff DM screenshot,
 * recruiting questionnaire, offer letter). The label is generic so users
 * understand any of them is acceptable.
 *
 * Note: this is the FORM only — actual proof uploads go to whatever
 * hosting the user uses (Imgur, Drive, etc.) and they paste the link.
 * Hosting is intentionally out of scope so admins always review the
 * source link, never an attachment we'd be liable for storing.
 */
export function RecruitVerificationForm({ disabled }: Props) {
  const router = useRouter();
  // Combobox + program selector state. `universityId` / `schoolId` are
  // the structured IDs admin tooling prefers; `sport` / `universityName`
  // mirror them as display strings for the existing API contract.
  const [sport, setSport] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  // The verification schema's `proofUrl` field holds the primary
  // recruiting proof (visit / invite / DM / offer / questionnaire) and
  // `recruitingProfileUrl` holds the optional recruiting profile cross-
  // check. Names below are kept generic in the UI so users understand
  // any of the spec's listed proof types is acceptable.
  const [proofUrl, setProofUrl] = useState("");
  const [recruitingProfileUrl, setRecruitingProfileUrl] = useState("");
  const [secondaryProofUrl, setSecondaryProofUrl] = useState("");
  const [gradYear, setGradYear] = useState<string>("");
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
    const payload = {
      method: "PROOF_UPLOAD" as const,
      sport,
      universityName,
      universityId: universityId || undefined,
      schoolId: schoolId || undefined,
      recruitingProfileUrl: recruitingProfileUrl || undefined,
      proofUrl: proofUrl || undefined,
      gradYear: gradYear ? Number(gradYear) : undefined,
      notes:
        [notes, secondaryProofUrl ? `Secondary proof: ${secondaryProofUrl}` : null]
          .filter(Boolean)
          .join("\n\n") || undefined,
    };
    // eslint-disable-next-line no-console
    console.debug("[RecruitVerificationForm] submitting", payload);
    const res = await fetch("/api/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Could not submit.");
      return;
    }
    setDone(typeof j.note === "string" ? j.note : "Submitted for review.");
    router.refresh();
  }

  if (done) {
    return (
      <div className="card p-4 text-sm text-emerald-800">
        {done}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
        <h4 className="font-semibold">How we verify recruits</h4>
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            • Provide the <strong>school recruiting you</strong> and the
            <strong> sport</strong>.
          </li>
          <li>
            • Add at least one piece of recruiting proof — any of:
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              <li>official visit confirmation</li>
              <li>camp invite</li>
              <li>email or DM from a staff member</li>
              <li>recruiting questionnaire</li>
              <li>offer letter</li>
              <li>recruiting profile (247 / On3 / NCSA / MaxPreps / etc.)</li>
            </ul>
          </li>
          <li>
            • Once approved you can post a <strong>Recruiting Experience Review</strong>
            for that school. You cannot post coach, program, or campus
            reviews until you actually enroll and re-verify as a current
            athlete.
          </li>
          <li>
            • Fake or AI-generated proof leads to rejection and account removal.
          </li>
        </ul>
      </div>

      <div className="card space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <UniversityCombobox
            label="School recruiting you"
            value={universityId}
            onChange={(id, u: UniversityOption | null) => {
              setUniversityId(id);
              setUniversityName(u?.name ?? "");
              // Switching schools invalidates the previously-picked sport.
              setSchoolId("");
              setSport("");
            }}
            required
          />
          <ProgramCombobox
            label="Sport / program"
            universityId={universityId}
            value={schoolId}
            onChange={(id, p) => {
              setSchoolId(id);
              setSport(p?.sport ?? "");
            }}
            required
          />
        </div>

        <div>
          <label className="label">
            Recruiting proof URL{" "}
            <span className="text-slate-400">
              (visit confirmation / camp invite / DM screenshot / offer / questionnaire)
            </span>
          </label>
          <input
            className="input"
            type="url"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="https://… link to a hosted image / document"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Use any public host — admins only need a link they can open.
          </p>
        </div>

        <div>
          <label className="label">
            Recruiting profile URL{" "}
            <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className="input"
            type="url"
            value={recruitingProfileUrl}
            onChange={(e) => setRecruitingProfileUrl(e.target.value)}
            placeholder="247Sports / On3 / NCSA / MaxPreps / Hudl"
          />
        </div>

        <div>
          <label className="label">
            Additional proof URL{" "}
            <span className="text-slate-400">(optional, second source)</span>
          </label>
          <input
            className="input"
            type="url"
            value={secondaryProofUrl}
            onChange={(e) => setSecondaryProofUrl(e.target.value)}
            placeholder="https://… anything that helps the admin verify"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">
              Grad year <span className="text-slate-400">(optional)</span>
            </label>
            <input
              className="input"
              type="number"
              min={1950}
              max={CURRENT_YEAR + 6}
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              placeholder="e.g. 2026"
            />
          </div>
        </div>

        <div>
          <label className="label">
            Context for the admin <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            className="input min-h-[80px]"
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything that helps the admin verify — recruiter name, dates of contact, camps attended, etc."
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button className="btn-primary" disabled={busy}>
          {busy ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
