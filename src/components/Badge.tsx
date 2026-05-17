import { UserRole } from "@prisma/client";
import { cn } from "@/lib/cn";

const STYLES: Record<UserRole, { label: string; className: string }> = {
  VERIFIED_ATHLETE: {
    label: "Verified Athlete",
    // Emerald — current college athletes.
    className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20",
  },
  VERIFIED_ATHLETE_ALUMNI: {
    label: "Verified Athlete Alumni",
    // Same checkmark family as VERIFIED_ATHLETE, but a distinct violet
    // palette so readers can tell former athletes apart at a glance
    // without losing the "athlete-trusted" visual signal.
    className: "bg-violet-100 text-violet-800 ring-1 ring-violet-600/20",
  },
  VERIFIED_STUDENT: {
    label: "Verified Student",
    // Sky — current students.
    className: "bg-sky-100 text-sky-800 ring-1 ring-sky-600/20",
  },
  VERIFIED_STUDENT_ALUMNI: {
    label: "Verified Student Alumni",
    // Same student family (cooler blue palette) but a distinct teal so
    // readers can tell former students apart at a glance, without losing
    // the "student-trusted" visual signal. Pairs visually with the violet
    // VERIFIED_ATHLETE_ALUMNI badge so all alumni roles read together.
    className: "bg-teal-100 text-teal-800 ring-1 ring-teal-600/20",
  },
  VERIFIED_PARENT: {
    label: "Verified Parent",
    className: "bg-amber-100 text-amber-800 ring-1 ring-amber-600/20",
  },
  // Indigo — recruits sit visually between current athletes (emerald) and
  // alumni (violet) so it's obvious they're a distinct trust group, not
  // either of them.
  VERIFIED_RECRUIT: {
    label: "Verified Recruit",
    className: "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-600/20",
  },
  ADMIN: {
    label: "Admin",
    className: "bg-slate-900 text-white",
  },
  // Master admin gets a slightly different shade so master-vs-staff is
  // visually distinguishable in any UI that surfaces the badge.
  MASTER_ADMIN: {
    label: "Master Admin",
    className: "bg-indigo-900 text-white",
  },
  VIEWER: {
    label: "Unverified",
    className: "bg-slate-100 text-slate-700",
  },
};

// Every verified role gets the checkmark glyph — athletes, students, and
// their alumni equivalents. Admin/Viewer stay glyph-free.
const SHOWS_CHECKMARK: Record<UserRole, boolean> = {
  VERIFIED_ATHLETE: true,
  VERIFIED_ATHLETE_ALUMNI: true,
  VERIFIED_STUDENT: true,
  VERIFIED_STUDENT_ALUMNI: true,
  VERIFIED_PARENT: true,
  VERIFIED_RECRUIT: true,
  ADMIN: false,
  MASTER_ADMIN: false,
  VIEWER: false,
};

export function Badge({ role, compact = false }: { role: UserRole; compact?: boolean }) {
  const s = STYLES[role];
  return (
    <span className={cn("badge", s.className, compact && "px-2 py-0.5 text-[10px]")}>
      {SHOWS_CHECKMARK[role] && (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 00-1.4-1.4L8 11.1 4.7 7.8a1 1 0 10-1.4 1.4l4 4a1 1 0 001.4 0l8-8z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {s.label}
    </span>
  );
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  VERIFIED_ATHLETE:
    "Current college athlete. Rate coaches, programs, NIL, food, facilities, and more.",
  VERIFIED_ATHLETE_ALUMNI:
    "Former college athlete. Same access as Verified Athletes — reviews are weighted slightly lower so present-day program reality leads, while experienced voices still surface.",
  VERIFIED_STUDENT:
    "Currently enrolled student. Rate universities, dorms, and campus life.",
  VERIFIED_STUDENT_ALUMNI:
    "Former student. Same access as Verified Students — reviews are weighted slightly lower so present-day campus reality leads, while former students still surface.",
  VERIFIED_PARENT:
    "Parent of a current or prospective athlete. Submit structured parent insights.",
  VERIFIED_RECRUIT:
    "Prospective athlete being recruited. Submit Recruiting Experience Reviews only — no coach, program, or campus reviews until you actually attend.",
  ADMIN: "University Verified team — moderation and verification.",
  MASTER_ADMIN: "University Verified owner — full admin + team management access.",
  VIEWER: "Free, read-only access.",
};
