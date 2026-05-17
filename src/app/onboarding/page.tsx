"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Post-signup role picker. Five clear options:
 *   - Current Athlete   → VERIFIED_ATHLETE
 *   - Athlete Alumni    → VERIFIED_ATHLETE_ALUMNI
 *   - Student           → VERIFIED_STUDENT
 *   - Parent            → VERIFIED_PARENT
 *   - Other             → VIEWER (no verification, read-only)
 *
 * Choosing any non-Other role redirects to /verification. "Other" goes
 * straight to /dashboard since no proof step is needed.
 *
 * No Stripe in this MVP step — the eventual /pricing flow can be inserted
 * between this picker and /verification later.
 */
type SelectableRole =
  | "VERIFIED_ATHLETE"
  | "VERIFIED_ATHLETE_ALUMNI"
  | "VERIFIED_RECRUIT"
  | "VERIFIED_STUDENT"
  | "VERIFIED_STUDENT_ALUMNI"
  | "VERIFIED_PARENT"
  | "VIEWER";

interface RoleCard {
  value: SelectableRole;
  title: string;
  emoji: string;
  bullets: string[];
  nextLabel: string;
}

const ROLES: RoleCard[] = [
  {
    value: "VERIFIED_ATHLETE",
    title: "Current Athlete",
    emoji: "🏋️",
    bullets: [
      "On a current college roster",
      "Rate coaches, programs, NIL, food, facilities",
      "Verification: official roster URL + student ID",
    ],
    nextLabel: "Verify as Current Athlete",
  },
  {
    value: "VERIFIED_ATHLETE_ALUMNI",
    title: "Athlete Alumni",
    emoji: "🎖️",
    bullets: [
      "Former college athlete",
      "Same access as current athletes",
      "Verification: past roster URL or alumni proof + ID",
    ],
    nextLabel: "Verify as Athlete Alumni",
  },
  {
    value: "VERIFIED_RECRUIT",
    title: "Recruit",
    emoji: "📨",
    bullets: [
      "Being recruited but not yet on a roster",
      "Rate the recruiting process only — no coach, program, or campus reviews until you enroll",
      "Verification: visit / camp invite / staff DM / questionnaire / offer / recruiting profile",
    ],
    nextLabel: "Verify as Recruit",
  },
  {
    value: "VERIFIED_STUDENT",
    title: "Student",
    emoji: "🎓",
    bullets: [
      "Currently enrolled",
      "Rate universities, dorms, campus life",
      "Verification: .edu email or student ID",
    ],
    nextLabel: "Verify as Student",
  },
  {
    value: "VERIFIED_STUDENT_ALUMNI",
    title: "Student Alumni",
    emoji: "🧑‍🎓",
    bullets: [
      "Former student / graduate",
      "Same access as current students",
      "Verification: alumni email or documentation",
    ],
    nextLabel: "Verify as Student Alumni",
  },
  {
    value: "VERIFIED_PARENT",
    title: "Parent",
    emoji: "👨‍👩‍👦",
    bullets: [
      "Parent of an athlete or prospective athlete",
      "Submit structured parent insights",
      "Verification: confirmed email",
    ],
    nextLabel: "Verify as Parent",
  },
  {
    value: "VIEWER",
    title: "Other",
    emoji: "👀",
    bullets: [
      "Just here to read reviews",
      "No verification required",
      "You can change your role any time",
    ],
    nextLabel: "Continue as Reader",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [selected, setSelected] = useState<SelectableRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "loading") {
    return <div className="container-page py-16 text-center text-sm text-slate-500">Loading…</div>;
  }
  if (status === "unauthenticated") {
    router.push("/sign-in?callbackUrl=/onboarding");
    return null;
  }

  async function submit() {
    if (!selected) {
      setError("Choose a role to continue.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await fetch("/api/onboarding/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: selected }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Could not save role.");
      return;
    }
    // Update the cached session so downstream pages see the new role
    // immediately without a manual refresh.
    router.refresh();
    router.push(selected === "VIEWER" ? "/dashboard" : "/verification");
  }

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Welcome{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""} — how will you use MyUniversityVerified?
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Pick the role that matches you best. Each role unlocks a different set of reviews
          and a tailored verification flow. You can change this later.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => {
            const active = selected === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  setSelected(r.value);
                  setError(null);
                }}
                className={`card text-left transition ${
                  active
                    ? "ring-2 ring-brand-500 shadow-card"
                    : "hover:shadow-card"
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                    {r.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-900">{r.title}</h3>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                      {r.bullets.map((b) => (
                        <li key={b}>• {b}</li>
                      ))}
                    </ul>
                  </div>
                  <div
                    className={`mt-1 h-4 w-4 shrink-0 rounded-full border ${
                      active ? "border-brand-600 bg-brand-600" : "border-slate-300"
                    }`}
                    aria-hidden
                  />
                </div>
              </button>
            );
          })}
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Verification keeps reviews honest — fake or AI-generated proof leads to rejection
            and removal.
          </p>
          <button
            onClick={submit}
            disabled={busy || !selected}
            className="btn-primary disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : selected
              ? ROLES.find((r) => r.value === selected)!.nextLabel + " →"
              : "Choose a role"}
          </button>
        </div>
      </div>
    </div>
  );
}
