"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailCodeVerificationForm } from "@/components/verification/EmailCodeVerificationForm";
import {
  UniversityCombobox,
  type UniversityOption,
} from "@/components/shared/UniversityCombobox";
import { ProgramCombobox } from "@/components/shared/ProgramCombobox";

type Method = "EDU_EMAIL" | "ROSTER_LINK" | "PROOF_UPLOAD";

const TABS: { id: Method; label: string; help: string }[] = [
  {
    id: "EDU_EMAIL",
    label: ".edu Email",
    help: "Fastest path. We'll email a 6-digit code to your team-issued .edu address.",
  },
  {
    id: "ROSTER_LINK",
    label: "Roster Link",
    help: "Paste a link to your name on an official athletics roster page.",
  },
  {
    id: "PROOF_UPLOAD",
    label: "Manual proof",
    help: "Always reviewed by an admin — never auto-approved.",
  },
];

const CURRENT_YEAR = new Date().getFullYear();

interface Props {
  disabled: boolean;
  /** When true, render alumni-specific copy + extra fields (gradYear, playingYears). */
  alumni?: boolean;
}

export function AthleteVerificationForm({ disabled, alumni = false }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Method>("EDU_EMAIL");

  // Common structured fields (required for every athlete + alumni method
  // except .edu email — which is handled by the inline EmailCodeVerificationForm).
  // `universityId` / `schoolId` are populated when the user picks from
  // the shared combobox; admin tooling prefers them. `sport` /
  // `universityName` stay as the display strings + the fallback for
  // schools we don't have in our DB (admin will handle manually).
  const [sport, setSport] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [studentIdUrl, setStudentIdUrl] = useState("");
  const [rosterScreenshotUrl, setRosterScreenshotUrl] = useState("");
  const [rosterUrl, setRosterUrl] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [notes, setNotes] = useState("");

  // Alumni-only context fields.
  const [gradYear, setGradYear] = useState<string>("");
  const [playingYears, setPlayingYears] = useState("");

  // External profile cross-checks. All optional. Each one bumps the
  // auto-confidence score and gives the admin scorecard another data point.
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [hudlUrl, setHudlUrl] = useState("");
  const [recruitingProfileUrl, setRecruitingProfileUrl] = useState("");
  const [schoolDirectoryUrl, setSchoolDirectoryUrl] = useState("");

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
    // eslint-disable-next-line no-console
    console.debug("[AthleteVerificationForm] submitting", {
      tab,
      universityId,
      schoolId,
      sport,
      universityName,
    });
    const res = await fetch("/api/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: tab,
        rosterUrl: tab === "ROSTER_LINK" ? rosterUrl : "",
        proofUrl: tab === "PROOF_UPLOAD" ? proofUrl : "",
        sport,
        universityName,
        universityId: universityId || undefined,
        schoolId: schoolId || undefined,
        studentIdUrl,
        rosterScreenshotUrl: rosterScreenshotUrl || undefined,
        gradYear: alumni && gradYear ? Number(gradYear) : undefined,
        playingYears: alumni ? playingYears || undefined : undefined,
        linkedinUrl: linkedinUrl || undefined,
        hudlUrl: hudlUrl || undefined,
        recruitingProfileUrl: recruitingProfileUrl || undefined,
        schoolDirectoryUrl: schoolDirectoryUrl || undefined,
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

  return (
    <div className="space-y-4">
      <SafetyCard alumni={alumni} />

      <div className="card space-y-4 p-4">
        <div>
          <h3 className="text-sm font-semibold">
            {alumni ? "Verified Athlete Alumni" : "Verified Athlete"} — choose a method
          </h3>
          <p className="text-xs text-slate-500">
            Manual uploads always require admin review. Edited or unclear images are rejected.
            Attempts are limited and logged.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={`rounded-full px-3 py-1 text-sm ${
                tab === t.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500">{TABS.find((t) => t.id === tab)!.help}</p>

        {tab === "EDU_EMAIL" && (
          <EmailCodeVerificationForm
            purposeLabel={
              alumni ? "Athlete alumni .edu verification" : "Athlete .edu verification"
            }
            requireEdu
          />
        )}

        {tab !== "EDU_EMAIL" && (
          <form onSubmit={submit} className="space-y-3">
            {/* --- Identity context --- */}
            <div className="grid gap-3 sm:grid-cols-2">
              <UniversityCombobox
                label="School / university"
                value={universityId}
                onChange={(id, u: UniversityOption | null) => {
                  setUniversityId(id);
                  setUniversityName(u?.name ?? "");
                  // Reset sport / program when the university changes —
                  // a sport picked under the old uni isn't valid for
                  // the new one.
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

            {/* --- Student ID (required for current athletes; required-or-doc for alumni) --- */}
            <div>
              <label className="label">
                {alumni ? "Student ID or alumni documentation URL" : "Student ID URL"}
              </label>
              <input
                className="input"
                type="url"
                required={!alumni}
                value={studentIdUrl}
                onChange={(e) => setStudentIdUrl(e.target.value)}
                placeholder="https://… (link to a hosted image of your ID)"
              />
              <p className="mt-1 text-xs text-slate-500">
                {alumni
                  ? "Link to a hosted image of your former student ID, alumni card, or other school-issued documentation. Image alone is supporting evidence — pair it with a roster URL when possible."
                  : "Link to a hosted image of your current student ID. Image alone is supporting evidence — pair it with an official roster URL when possible."}
              </p>
            </div>

            {tab === "ROSTER_LINK" && (
              <div>
                <label className="label">Official roster / profile URL</label>
                <input
                  className="input"
                  type="url"
                  required
                  value={rosterUrl}
                  onChange={(e) => setRosterUrl(e.target.value)}
                  placeholder="https://gostanford.com/sports/baseball/roster/…"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Must be on an official school or athletics domain. Shorteners (bit.ly) and
                  generic Drive links are rejected.
                </p>
              </div>
            )}

            {tab === "PROOF_UPLOAD" && (
              <div>
                <label className="label">Supporting proof URL</label>
                <input
                  className="input"
                  type="url"
                  required
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://…"
                />
                <p className="mt-1 text-xs text-slate-500">
                  File upload coming soon — for now paste a link to a public image. Manual
                  uploads are <em>never</em> auto-approved.
                </p>
              </div>
            )}

            {/* --- Optional supporting screenshot --- */}
            <div>
              <label className="label">Roster screenshot URL <span className="text-slate-400">(optional)</span></label>
              <input
                className="input"
                type="url"
                value={rosterScreenshotUrl}
                onChange={(e) => setRosterScreenshotUrl(e.target.value)}
                placeholder="https://… (optional supporting image)"
              />
              <p className="mt-1 text-xs text-slate-500">
                Helpful when a roster page exists but doesn't include your name (e.g. walk-ons).
                Treated as supporting evidence only.
              </p>
            </div>

            {/* --- Alumni-only history --- */}
            {alumni && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Graduation year</label>
                  <input
                    className="input"
                    type="number"
                    min={1950}
                    max={CURRENT_YEAR + 1}
                    value={gradYear}
                    onChange={(e) => setGradYear(e.target.value)}
                    placeholder="e.g. 2022"
                  />
                </div>
                <div>
                  <label className="label">Playing years</label>
                  <input
                    className="input"
                    value={playingYears}
                    onChange={(e) => setPlayingYears(e.target.value)}
                    placeholder="e.g. 2018-2022"
                    maxLength={40}
                  />
                </div>
              </div>
            )}

            {/* --- Optional external profile cross-checks --- */}
            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
                External profiles <span className="font-normal text-slate-400">(optional, all help)</span>
              </legend>
              <p className="text-xs text-slate-500">
                Any extra link an admin can cross-check against — bumps your auto-confidence
                score so we can approve faster.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  className="input"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="LinkedIn URL"
                />
                <input
                  className="input"
                  type="url"
                  value={recruitingProfileUrl}
                  onChange={(e) => setRecruitingProfileUrl(e.target.value)}
                  placeholder="Hudl / 247 / On3 / NCSA / MaxPreps URL"
                />
                <input
                  className="input"
                  type="url"
                  value={hudlUrl}
                  onChange={(e) => setHudlUrl(e.target.value)}
                  placeholder="Hudl highlight URL"
                />
                <input
                  className="input"
                  type="url"
                  value={schoolDirectoryUrl}
                  onChange={(e) => setSchoolDirectoryUrl(e.target.value)}
                  placeholder="School directory URL"
                />
              </div>
            </fieldset>

            <div>
              <label className="label">Notes (optional)</label>
              <textarea
                className="input min-h-[80px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                placeholder={
                  alumni
                    ? "Anything that helps the admin verify — coaching staff at the time, jersey number, etc."
                    : "Anything that helps the admin verify — jersey number, position, etc."
                }
              />
            </div>

            {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
            <button className="btn-primary" disabled={busy}>
              {busy ? "Submitting…" : "Submit for review"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Trust + fraud-prevention copy. Rendered above every athlete/alumni form so
 * users see the rules before they upload anything.
 */
function SafetyCard({ alumni }: { alumni: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <h4 className="font-semibold">How we verify {alumni ? "athlete alumni" : "athletes"}</h4>
      <ul className="mt-2 space-y-1 text-xs text-amber-900">
        <li>• An <strong>official roster / profile URL</strong> is preferred whenever possible.</li>
        <li>
          • Uploaded images (student ID, screenshots) are <strong>supporting evidence only</strong> —
          they are not enough on their own.
        </li>
        <li>• Verification may be <strong>manually reviewed</strong> by an admin.</li>
        <li>
          • Fake, edited, or AI-generated proof leads to{" "}
          <strong>rejection and account removal</strong>.
        </li>
      </ul>
    </div>
  );
}
