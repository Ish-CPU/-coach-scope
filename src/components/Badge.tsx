import { UserRole } from "@prisma/client";
import { cn } from "@/lib/cn";

const STYLES: Record<UserRole, { label: string; className: string }> = {
  VERIFIED_ATHLETE: {
    label: "Verified Athlete",
    className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20",
  },
  VERIFIED_STUDENT: {
    label: "Verified Student",
    className: "bg-sky-100 text-sky-800 ring-1 ring-sky-600/20",
  },
  VERIFIED_PARENT: {
    label: "Verified Parent",
    className: "bg-amber-100 text-amber-800 ring-1 ring-amber-600/20",
  },
  ADMIN: {
    label: "Admin",
    className: "bg-slate-900 text-white",
  },
  VIEWER: {
    label: "Free Viewer",
    className: "bg-slate-100 text-slate-700",
  },
};

export function Badge({ role, compact = false }: { role: UserRole; compact?: boolean }) {
  const s = STYLES[role];
  return (
    <span className={cn("badge", s.className, compact && "px-2 py-0.5 text-[10px]")}>
      {role === "VERIFIED_ATHLETE" && (
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
    "Current or former college athlete. Rate coaches, programs, NIL, food, facilities, and more.",
  VERIFIED_STUDENT:
    "Enrolled or former student. Rate universities, dorms, and campus life.",
  VERIFIED_PARENT:
    "Parent of a current or prospective athlete. Submit structured parent insights.",
  ADMIN: "Coach Scope team — moderation and verification.",
  VIEWER: "Free, read-only access.",
};
