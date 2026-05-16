/**
 * Lifecycle helpers — alumni-aware role/status reasoning.
 *
 * Design:
 *   - Role identity (RECRUIT / ATHLETE / STUDENT / PARENT / etc.) stays on
 *     `User.role`. We did not rename the enum; existing rows + dozens of
 *     downstream gates keep working.
 *   - `isAlumni` is a boolean flag orthogonal to role. A
 *     VERIFIED_ATHLETE with isAlumni=true is a former athlete and is the
 *     canonical representation going forward. The legacy
 *     `*_ALUMNI` role values (VERIFIED_ATHLETE_ALUMNI, VERIFIED_STUDENT_ALUMNI)
 *     still exist for back-compat — `isUserAlumni` below treats either signal
 *     as alumni so callers don't have to remember.
 *
 * These helpers are pure (no Prisma). The few callers that need a fresh
 * `User` should load it themselves first; this lets the same helpers run on
 * either a NextAuth session.user (no DB hit) or a fresh Prisma row.
 */

import { UserRole } from "@prisma/client";

/**
 * Minimal shape we read off a User-ish object. Both the NextAuth session
 * user (after our augmentation in `src/lib/auth.ts`) and a fresh
 * `prisma.user.findUnique` row satisfy this.
 */
export interface LifecycleUserLike {
  role: UserRole;
  isAlumni?: boolean | null;
  alumniSince?: Date | string | null;
  formerUniversityId?: string | null;
  formerProgramId?: string | null;
  graduationYear?: number | null;
  lastRosterSeason?: number | null;
}

/** UserRole values that legacy code uses to denote alumni without the flag. */
export const LEGACY_ALUMNI_ROLES = new Set<UserRole>([
  UserRole.VERIFIED_ATHLETE_ALUMNI,
  UserRole.VERIFIED_STUDENT_ALUMNI,
]);

/**
 * True if the user is alumni. Belt-and-suspenders: the boolean is the
 * canonical signal, but the legacy *_ALUMNI roles still count so callers
 * can stop branching on enum identity.
 */
export function isUserAlumni(user: LifecycleUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.isAlumni === true) return true;
  return LEGACY_ALUMNI_ROLES.has(user.role);
}

/**
 * "Active" = the user is currently affiliated (not alumni). Almost always
 * the inverse of isUserAlumni, broken out as its own function so call sites
 * read clearly.
 */
export function isUserCurrent(user: LifecycleUserLike | null | undefined): boolean {
  if (!user) return false;
  return !isUserAlumni(user);
}

/**
 * Coarse identity bucket — used for badge selection, group-audience
 * matching, and search filters. Returns one of:
 *   "athlete" | "student" | "parent" | "recruit" | "viewer" | "admin"
 *
 * Does NOT split alumni vs current — pair with isUserAlumni for that.
 */
export type LifecycleIdentity =
  | "athlete"
  | "student"
  | "parent"
  | "recruit"
  | "viewer"
  | "admin";

export function lifecycleIdentity(role: UserRole): LifecycleIdentity {
  switch (role) {
    case UserRole.VERIFIED_ATHLETE:
    case UserRole.VERIFIED_ATHLETE_ALUMNI:
      return "athlete";
    case UserRole.VERIFIED_STUDENT:
    case UserRole.VERIFIED_STUDENT_ALUMNI:
      return "student";
    case UserRole.VERIFIED_PARENT:
      return "parent";
    case UserRole.VERIFIED_RECRUIT:
      return "recruit";
    case UserRole.ADMIN:
    case UserRole.MASTER_ADMIN:
      return "admin";
    case UserRole.VIEWER:
    default:
      return "viewer";
  }
}

/**
 * Human-readable label for the profile chip / review attribution line.
 * Examples:
 *   "Verified athlete · Stanford"
 *   "Former athlete · USC (2024)"
 *   "Alumni student · UCLA (Class of 2025)"
 *   "Recruit"
 *   "Parent"
 *
 * The "when" string prefers `lastRosterSeason` for athletes and
 * `graduationYear` for students; both fall back to alumniSince year if
 * neither is set. Pass `currentSchoolName` and `formerSchoolName` when you
 * have them — the helper deliberately doesn't fetch from Prisma.
 */
export function lifecycleLabel(
  user: LifecycleUserLike,
  opts?: { currentSchoolName?: string | null; formerSchoolName?: string | null }
): string {
  const id = lifecycleIdentity(user.role);
  const alumni = isUserAlumni(user);

  if (id === "athlete") {
    const when =
      user.lastRosterSeason ??
      user.graduationYear ??
      yearOf(user.alumniSince);
    if (alumni) {
      const where = opts?.formerSchoolName ?? opts?.currentSchoolName;
      return where
        ? `Former athlete · ${where}${when ? ` (${when})` : ""}`
        : "Former athlete";
    }
    return opts?.currentSchoolName
      ? `Verified athlete · ${opts.currentSchoolName}`
      : "Verified athlete";
  }

  if (id === "student") {
    const when = user.graduationYear ?? yearOf(user.alumniSince);
    if (alumni) {
      const where = opts?.formerSchoolName ?? opts?.currentSchoolName;
      return where
        ? `Alumni · ${where}${when ? ` (Class of ${when})` : ""}`
        : "Alumni";
    }
    return opts?.currentSchoolName
      ? `Current student · ${opts.currentSchoolName}`
      : "Current student";
  }

  if (id === "recruit") return "Recruit";
  if (id === "parent") return "Parent";
  if (id === "admin") return "Admin";
  return "Member";
}

function yearOf(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const t = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(t.getTime())) return null;
  return t.getUTCFullYear();
}

/**
 * Group lifecycle-audience gate. Returns true if `user` is in the bucket
 * the group is open to. The match is one-direction (the user must be in
 * the group's audience, not the other way around) and never strips access
 * from admins — that's the caller's responsibility.
 */
export function lifecycleAudienceAllows(
  user: LifecycleUserLike | null | undefined,
  audience: "CURRENT_ONLY" | "ALUMNI_ONLY" | "CURRENT_AND_ALUMNI"
): boolean {
  if (audience === "CURRENT_AND_ALUMNI") return true;
  if (!user) return false;
  if (audience === "ALUMNI_ONLY") return isUserAlumni(user);
  return isUserCurrent(user); // CURRENT_ONLY
}

/**
 * Sanity guard for admin-driven lifecycle transitions. Returns a list of
 * issues (empty array = ok). Used by the admin lifecycle endpoint so the
 * UI can surface "you tried to mark a parent as alumni, that's a no-op".
 */
export function validateLifecycleTransition(
  user: LifecycleUserLike,
  next: { isAlumni: boolean; graduationYear?: number | null; lastRosterSeason?: number | null }
): string[] {
  const errs: string[] = [];
  const id = lifecycleIdentity(user.role);

  // Only the roles that have a lifecycle support the alumni flag.
  if (next.isAlumni && id !== "athlete" && id !== "student") {
    errs.push(
      `Cannot mark a ${id} as alumni — only athletes and students have an alumni lifecycle.`
    );
  }
  if (next.graduationYear != null) {
    const y = next.graduationYear;
    const now = new Date().getUTCFullYear();
    if (y < 1900 || y > now + 8) {
      errs.push(`graduationYear ${y} is outside the supported range.`);
    }
  }
  if (next.lastRosterSeason != null) {
    const y = next.lastRosterSeason;
    const now = new Date().getUTCFullYear();
    if (y < 1900 || y > now + 1) {
      errs.push(`lastRosterSeason ${y} is outside the supported range.`);
    }
  }
  return errs;
}
