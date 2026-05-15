"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AthleteConnectionType } from "@prisma/client";
import {
  UniversityCombobox,
  type UniversityOption,
} from "@/components/shared/UniversityCombobox";

const TYPE_LABELS: Record<AthleteConnectionType, string> = {
  CURRENT_ATHLETE: "Current athlete",
  ATHLETE_ALUMNI: "Athlete alumni",
  RECRUITED_BY: "Recruited by (no commit)",
  TRANSFERRED_FROM: "Transferred from",
  COMMITTED: "Committed (signed)",
  WALK_ON: "Walk-on",
};

const CURRENT_YEAR = new Date().getFullYear();

interface SchoolOption {
  id: string;
  sport: string;
}

/**
 * Add-a-connection form. Always submits as PENDING — admin approval is what
 * unlocks downstream review permissions. The UI surfaces that explicitly so
 * users know nothing is auto-approved.
 *
 * The university picker is a combobox (live search against
 * `/api/universities/search`) — there is intentionally no preloaded full
 * list passed in from the server. After a university is picked we fetch
 * its programs from `/api/universities/[id]/schools` to populate the
 * sport dropdown.
 *
 * `recruitOnly` locks the form to AthleteConnectionType.RECRUITED_BY only.
 * Used for VERIFIED_RECRUIT users who haven't enrolled anywhere — they can
 * declare which schools recruited them but cannot claim CURRENT_ATHLETE /
 * ATHLETE_ALUMNI / COMMITTED / WALK_ON / TRANSFERRED_FROM connections.
 * The API mirrors the same rule so a recruit can never bypass via direct
 * fetch.
 */
export function ConnectionForm({
  recruitOnly = false,
}: { recruitOnly?: boolean } = {}) {
  const router = useRouter();
  const [universityId, setUniversityId] = useState<string>("");
  const [universityName, setUniversityName] = useState<string>("");
  const [sport, setSport] = useState<string>("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [connectionType, setConnectionType] = useState<AthleteConnectionType>(
    recruitOnly
      ? AthleteConnectionType.RECRUITED_BY
      : AthleteConnectionType.CURRENT_ATHLETE
  );
  const [rosterUrl, setRosterUrl] = useState("");
  const [recruitingProofUrl, setRecruitingProofUrl] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Reset sport + fetch School rows whenever the picked university changes.
  // Empty universityId clears the sport list entirely.
  useEffect(() => {
    if (!universityId) {
      setSchools([]);
      setSport("");
      return;
    }
    let cancelled = false;
    setLoadingSchools(true);
    fetch(`/api/universities/${universityId}/schools`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((j: { schools: SchoolOption[] }) => {
        if (cancelled) return;
        setSchools(j.schools ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setSchools([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingSchools(false);
      });
    return () => {
      cancelled = true;
    };
  }, [universityId]);

  const sportsForUni = Array.from(new Set(schools.map((s) => s.sport))).sort();
  const schoolIdForSport = sport
    ? schools.find((s) => s.sport.toLowerCase() === sport.toLowerCase())?.id
    : undefined;

  const isRecruiting = connectionType === AthleteConnectionType.RECRUITED_BY;

  function handleUniversityChange(id: string, u: UniversityOption | null) {
    setUniversityId(id);
    setUniversityName(u?.name ?? "");
    // Reset sport — the previous pick is no longer valid for the new uni.
    setSport("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universityId,
        schoolId: schoolIdForSport,
        sport,
        connectionType,
        rosterUrl: rosterUrl || undefined,
        recruitingProofUrl: recruitingProofUrl || undefined,
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
            setRosterUrl("");
            setRecruitingProofUrl("");
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
        <h3 className="text-sm font-semibold">Add a program connection</h3>
        <p className="text-xs text-slate-500">
          Submitted as <strong>pending</strong>. An admin reviews each connection — never
          auto-approved. Only approved connections unlock review writing for that program.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <UniversityCombobox
          value={universityId}
          onChange={handleUniversityChange}
          required
        />
        <div>
          <label className="label">Sport / program</label>
          <select
            className="input"
            required
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            disabled={!universityId || loadingSchools}
          >
            <option value="">
              {!universityId
                ? "Pick a university first"
                : loadingSchools
                ? "Loading programs…"
                : sportsForUni.length === 0
                ? "No programs on file for this university"
                : "— Choose a sport —"}
            </option>
            {sportsForUni.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {universityId &&
            !loadingSchools &&
            sportsForUni.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-700">
                {universityName || "This university"} has no programs in our DB
                yet. Submit a program request from /request-school and an admin
                will add it.
              </p>
            )}
        </div>
      </div>

      <div>
        <label className="label">Connection type</label>
        <select
          className="input"
          required
          value={connectionType}
          onChange={(e) => setConnectionType(e.target.value as AthleteConnectionType)}
          disabled={recruitOnly}
        >
          {(recruitOnly
            ? [AthleteConnectionType.RECRUITED_BY]
            : Object.values(AthleteConnectionType)
          ).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {recruitOnly
            ? "Recruits can only file RECRUITED_BY connections — once approved, unlocks Recruiting Experience Reviews for this program. To claim insider access, commit / enroll and re-verify as a current athlete first."
            : isRecruiting
            ? "Used for recruiting reviews only — RECRUITED_BY does not unlock coach reviews for that program."
            : "Insider connection — once approved, unlocks coach + program reviews for this program."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">
            Roster URL <span className="text-slate-400">(strongly recommended)</span>
          </label>
          <input
            className="input"
            type="url"
            value={rosterUrl}
            onChange={(e) => setRosterUrl(e.target.value)}
            placeholder="https://athletics.school.edu/roster/your-name"
          />
        </div>
        <div>
          <label className="label">
            {isRecruiting ? "Recruiting proof URL" : "Other proof URL"}{" "}
            <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className="input"
            type="url"
            value={recruitingProofUrl}
            onChange={(e) => setRecruitingProofUrl(e.target.value)}
            placeholder={
              isRecruiting
                ? "Coach email screenshot, offer letter, NLI image…"
                : "https://… any supporting evidence"
            }
          />
        </div>
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
            placeholder="e.g. 2021"
          />
        </div>
        <div>
          <label className="label">End year (optional)</label>
          <input
            className="input"
            type="number"
            min={1950}
            max={CURRENT_YEAR + 5}
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
          placeholder={
            isRecruiting
              ? "Which coach recruited you? When? How were you contacted?"
              : "Anything that helps the admin verify (jersey number, position, coaches at the time, etc.)"
          }
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <button className="btn-primary" disabled={busy || !universityId || !sport}>
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
