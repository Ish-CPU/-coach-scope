"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UniversityCombobox,
  type UniversityOption,
} from "@/components/shared/UniversityCombobox";
import { ProgramCombobox } from "@/components/shared/ProgramCombobox";

/**
 * Recruit → Athlete upgrade form.
 *
 * Submits a NEW VerificationRequest to /api/verification with an explicit
 * `targetRole = VERIFIED_ATHLETE` (or VERIFIED_ATHLETE_ALUMNI for
 * transfer recruits enrolling at a former program — uncommon but the
 * server accepts both). The API enforces that this `targetRole` upgrade
 * is only legal for VERIFIED_RECRUIT users.
 *
 * Once an admin approves, the user's role flips to athlete-trusted and
 * (when the university is in our DB) an APPROVED insider connection is
 * auto-created on the same submission — no second manual /connections
 * step needed. Subscription, prior reviews, prior RECRUITED_BY
 * connections, badge history are all preserved on the same account.
 */

const CURRENT_YEAR = new Date().getFullYear();

interface Props {
  /** Disable submission while another request is in-flight. */
  disabled: boolean;
}

export function RecruitUpgradeForm({ disabled }: Props) {
  const router = useRouter();
  const [targetRole, setTargetRole] = useState<
    "VERIFIED_ATHLETE" | "VERIFIED_ATHLETE_ALUMNI"
  >("VERIFIED_ATHLETE");
  // Combobox + program selector state. The admin approval handler reads
  // universityId / schoolId first when auto-creating the insider
  // connection, falling back to fuzzy name match.
  const [sport, setSport] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [rosterUrl, setRosterUrl] = useState("");
  const [studentIdUrl, setStudentIdUrl] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [gradYear, setGradYear] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (disabled) {
    return (
      <div className="card p-4 text-sm text-slate-600">
        You have a pending verification request. An admin will review it before
        the upgrade can be submitted.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    // eslint-disable-next-line no-console
    console.debug("[RecruitUpgradeForm] submitting", {
      targetRole,
      universityId,
      schoolId,
      sport,
      universityName,
    });
    const res = await fetch("/api/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "PROOF_UPLOAD",
        targetRole,
        sport,
        universityName,
        universityId: universityId || undefined,
        schoolId: schoolId || undefined,
        rosterUrl: rosterUrl || undefined,
        studentIdUrl: studentIdUrl || undefined,
        proofUrl: proofUrl || undefined,
        gradYear: gradYear ? Number(gradYear) : undefined,
        notes: notes || undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Could not submit.");
      return;
    }
    setDone(
      "Upgrade submitted. An admin will review your roster + student ID and promote you to Verified Athlete — your recruit reviews and connections stay attached to this account."
    );
    router.refresh();
  }

  if (done) {
    return <div className="card p-4 text-sm text-emerald-800">{done}</div>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <h4 className="font-semibold">Upgrading to Verified Athlete</h4>
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            • Same account — keeps your <strong>recruiting reviews</strong>,
            <strong> recruited-by connections</strong>, badge history, and
            <strong> subscription</strong>.
          </li>
          <li>
            • Once approved, we'll auto-create an APPROVED current-athlete
            connection for the school below so coach + program reviews unlock
            immediately.
          </li>
          <li>
            • Fake or AI-generated proof leads to rejection and account removal.
          </li>
        </ul>
      </div>

      <div className="card space-y-4 p-4">
        <div>
          <label className="label">Upgrading as</label>
          <select
            className="input"
            value={targetRole}
            onChange={(e) =>
              setTargetRole(
                e.target.value as "VERIFIED_ATHLETE" | "VERIFIED_ATHLETE_ALUMNI"
              )
            }
          >
            <option value="VERIFIED_ATHLETE">
              Current Athlete (enrolled / on roster)
            </option>
            <option value="VERIFIED_ATHLETE_ALUMNI">
              Athlete Alumni (former roster)
            </option>
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Pick "Current" if you're on the active roster today; pick "Alumni"
            only if you're verifying for a program you've already left.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <UniversityCombobox
            label="School joined"
            value={universityId}
            onChange={(id, u: UniversityOption | null) => {
              setUniversityId(id);
              setUniversityName(u?.name ?? "");
              // Switching the school invalidates the previously-picked
              // sport — it likely doesn't exist at the new uni.
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
        <p className="-mt-2 text-[11px] text-slate-500">
          Picking from the lists above auto-creates your insider connection
          when an admin approves. If your school isn't in our DB yet, submit
          a request at <a href="/request-school" className="underline">/request-school</a>.
        </p>

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
            Student ID URL{" "}
            <span className="text-slate-400">
              (hosted image — link only, do not upload here)
            </span>
          </label>
          <input
            className="input"
            type="url"
            value={studentIdUrl}
            onChange={(e) => setStudentIdUrl(e.target.value)}
            placeholder="https://… link to a hosted image"
          />
        </div>

        <div>
          <label className="label">
            Additional proof URL <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className="input"
            type="url"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="https://… NLI image, athletic-aid letter, anything supporting"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">
              Class year <span className="text-slate-400">(optional)</span>
            </label>
            <input
              className="input"
              type="number"
              min={1950}
              max={CURRENT_YEAR + 6}
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              placeholder="e.g. 2028"
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
            placeholder="Anything that helps the admin verify — coaches you'll play under, jersey number, position, signing date, etc."
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>
        )}

        <button className="btn-primary" disabled={busy}>
          {busy ? "Submitting…" : "Submit upgrade to Verified Athlete"}
        </button>
      </div>
    </form>
  );
}
