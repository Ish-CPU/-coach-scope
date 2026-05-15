/**
 * Per-target review permission checks.
 *
 * Single source of truth for "can this user submit this kind of review against
 * this specific target?" — driven by the AthleteProgramConnection model. Pure
 * functions only; no UI / no transport. Both the API and the UI go through
 * these helpers so the rule of "athletes can only review programs they're
 * connected to" is enforced once.
 *
 * Admins always pass. Non-athletes / unverified users are rejected up-front.
 */
import { prisma } from "@/lib/prisma";
import {
  AthleteConnectionStatus,
  AthleteConnectionType,
  ReviewType,
  StudentConnectionStatus,
  StudentConnectionType,
  UserRole,
} from "@prisma/client";
import {
  isAthleteTrustedRole,
  isRecruitRole,
  isStudentTrustedRole,
} from "@/lib/permissions";

/**
 * Connection types that grant program-level review access for the school
 * the athlete actually attended/played for.
 */
const PROGRAM_INSIDER_TYPES: ReadonlySet<AthleteConnectionType> = new Set([
  AthleteConnectionType.CURRENT_ATHLETE,
  AthleteConnectionType.ATHLETE_ALUMNI,
  AthleteConnectionType.COMMITTED,
  AthleteConnectionType.WALK_ON,
  AthleteConnectionType.TRANSFERRED_FROM,
]);

/**
 * Connection types that grant *recruiting-context* review access for a school
 * — the athlete didn't play there but interacted with the recruiting process.
 */
const RECRUITING_CONTEXT_TYPES: ReadonlySet<AthleteConnectionType> = new Set([
  AthleteConnectionType.RECRUITED_BY,
]);

// Student-side connection groupings (parallel to athlete groupings above).
// Insider types unlock UNIVERSITY/DORM reviews; admissions-context types only
// unlock the ADMISSIONS review type. Add a future role like
// `EXCHANGE_STUDENT` here and every per-action check inherits automatically.
const STUDENT_INSIDER_TYPES: ReadonlySet<StudentConnectionType> = new Set([
  StudentConnectionType.CURRENT_STUDENT,
  StudentConnectionType.STUDENT_ALUMNI,
  StudentConnectionType.TRANSFERRED_FROM,
]);

const ADMISSIONS_CONTEXT_TYPES: ReadonlySet<StudentConnectionType> = new Set([
  StudentConnectionType.ADMITTED_TO,
  StudentConnectionType.VISITED_CAMPUS,
]);

const APPROVED = AthleteConnectionStatus.APPROVED;
const STUDENT_APPROVED = StudentConnectionStatus.APPROVED;

interface SessionUserShape {
  id: string;
  role: UserRole;
}

/** Tiny type-narrowing helper for the session user payload we pass around. */
type MaybeUser = SessionUserShape | null | undefined;

// ---------------------------------------------------------------------------
// Internal: lookup connection rows in batched/efficient ways
// ---------------------------------------------------------------------------

async function hasApprovedConnectionToSchool(
  userId: string,
  schoolId: string,
  allowedTypes: ReadonlySet<AthleteConnectionType>
): Promise<boolean> {
  const row = await prisma.athleteProgramConnection.findFirst({
    where: {
      userId,
      schoolId,
      status: APPROVED,
      connectionType: { in: Array.from(allowedTypes) },
    },
    select: { id: true },
  });
  return !!row;
}

async function hasApprovedAthleteUniversityConnection(
  userId: string,
  universityId: string,
  allowedTypes?: ReadonlySet<AthleteConnectionType>
): Promise<boolean> {
  const row = await prisma.athleteProgramConnection.findFirst({
    where: {
      userId,
      universityId,
      status: APPROVED,
      ...(allowedTypes
        ? { connectionType: { in: Array.from(allowedTypes) } }
        : {}),
    },
    select: { id: true },
  });
  return !!row;
}

async function hasApprovedStudentConnection(
  userId: string,
  universityId: string,
  allowedTypes: ReadonlySet<StudentConnectionType>
): Promise<boolean> {
  const row = await prisma.studentUniversityConnection.findFirst({
    where: {
      userId,
      universityId,
      status: STUDENT_APPROVED,
      connectionType: { in: Array.from(allowedTypes) },
    },
    select: { id: true },
  });
  return !!row;
}

// ---------------------------------------------------------------------------
// Public per-action checks
// ---------------------------------------------------------------------------

/**
 * Coach reviews — athlete (current OR alumni) must have an APPROVED
 * insider connection (CURRENT_ATHLETE / ATHLETE_ALUMNI / COMMITTED / WALK_ON
 * / TRANSFERRED_FROM) to the same school the coach belongs to.
 *
 * RECRUITED_BY is *not* enough — recruiting-only context goes through the
 * RECRUITING review type instead.
 */
export async function canReviewCoach(
  user: MaybeUser,
  coachId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) return true;
  if (!isAthleteTrustedRole(user.role)) return false;

  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    select: { schoolId: true },
  });
  if (!coach) return false;

  return hasApprovedConnectionToSchool(
    user.id,
    coach.schoolId,
    PROGRAM_INSIDER_TYPES
  );
}

/**
 * Program (school) reviews — APPROVED insider connection OR APPROVED
 * RECRUITED_BY connection to the same school. Recruits can speak to a
 * program even though they didn't play there.
 */
export async function canReviewProgram(
  user: MaybeUser,
  schoolId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) return true;
  if (!isAthleteTrustedRole(user.role)) return false;

  // Insiders OR recruits.
  const allowed: Set<AthleteConnectionType> = new Set([
    ...PROGRAM_INSIDER_TYPES,
    ...RECRUITING_CONTEXT_TYPES,
  ]);
  return hasApprovedConnectionToSchool(user.id, schoolId, allowed);
}

/**
 * Recruiting reviews — only RECRUITED_BY APPROVED connection to the
 * targeted school. Insiders speak to coaches/programs through the COACH /
 * PROGRAM types instead.
 *
 * Three role groups can submit:
 *   - athlete-trusted (current + alumni) — they were recruited at some
 *     point in their career
 *   - VERIFIED_RECRUIT — prospective athletes whose ONLY review surface is
 *     recruiting; per-target gate still requires a RECRUITED_BY connection
 *     so they can't speak to schools that didn't actually recruit them
 *   - admins — bypass
 */
export async function canReviewRecruiting(
  user: MaybeUser,
  schoolId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) return true;
  if (!isAthleteTrustedRole(user.role) && !isRecruitRole(user.role)) return false;
  return hasApprovedConnectionToSchool(
    user.id,
    schoolId,
    RECRUITING_CONTEXT_TYPES
  );
}

/**
 * University reviews — APPROVED student-insider connection (CURRENT_STUDENT
 * / STUDENT_ALUMNI / TRANSFERRED_FROM) for student-trusted roles, OR any
 * athlete-insider connection to that university for athlete-trusted roles.
 *
 * Admissions / campus-visit context (ADMITTED_TO / VISITED_CAMPUS) is NOT
 * enough — those route through the ADMISSIONS review type instead.
 */
export async function canReviewUniversity(
  user: MaybeUser,
  universityId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) return true;

  if (isAthleteTrustedRole(user.role)) {
    return hasApprovedAthleteUniversityConnection(user.id, universityId);
  }
  if (isStudentTrustedRole(user.role)) {
    return hasApprovedStudentConnection(
      user.id,
      universityId,
      STUDENT_INSIDER_TYPES
    );
  }
  return false;
}

/**
 * Dorm reviews — same insider-only rule as UNIVERSITY: an APPROVED student
 * insider connection to the dorm's university, OR an APPROVED athlete
 * insider connection to that university (athletes who lived in dorms can
 * speak to them).
 */
export async function canReviewDorm(
  user: MaybeUser,
  dormId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) return true;

  const dorm = await prisma.dorm.findUnique({
    where: { id: dormId },
    select: { universityId: true },
  });
  if (!dorm) return false;

  if (isAthleteTrustedRole(user.role)) {
    return hasApprovedAthleteUniversityConnection(user.id, dorm.universityId);
  }
  if (isStudentTrustedRole(user.role)) {
    return hasApprovedStudentConnection(
      user.id,
      dorm.universityId,
      STUDENT_INSIDER_TYPES
    );
  }
  return false;
}

/**
 * Admissions reviews — student-trusted user with APPROVED ADMITTED_TO or
 * VISITED_CAMPUS connection to that university. Insiders speak through the
 * regular UNIVERSITY review type instead.
 */
export async function canReviewAdmissions(
  user: MaybeUser,
  universityId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) return true;
  if (!isStudentTrustedRole(user.role)) return false;
  return hasApprovedStudentConnection(
    user.id,
    universityId,
    ADMISSIONS_CONTEXT_TYPES
  );
}

/**
 * Centralized dispatcher used by the review API. Returns either `null`
 * (allowed) or a human-readable rejection message that the route hands back
 * verbatim with a 403.
 */
export async function describeReviewBlock(
  user: MaybeUser,
  reviewType: ReviewType,
  targets: {
    coachId?: string | null;
    schoolId?: string | null;
    universityId?: string | null;
    dormId?: string | null;
  }
): Promise<string | null> {
  if (!user) return "Sign in required.";
  if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) return null;

  switch (reviewType) {
    case ReviewType.COACH: {
      if (!targets.coachId) return "Coach is required.";
      const ok = await canReviewCoach(user, targets.coachId);
      if (!ok) return COACH_BLOCK_MESSAGE;
      return null;
    }
    case ReviewType.PROGRAM: {
      if (!targets.schoolId) return "Program is required.";
      const ok = await canReviewProgram(user, targets.schoolId);
      if (!ok) return PROGRAM_BLOCK_MESSAGE;
      return null;
    }
    case ReviewType.RECRUITING: {
      if (!targets.schoolId) return "Recruiting target program is required.";
      const ok = await canReviewRecruiting(user, targets.schoolId);
      if (!ok) return RECRUITING_BLOCK_MESSAGE;
      return null;
    }
    case ReviewType.UNIVERSITY: {
      if (!targets.universityId) return "University is required.";
      const ok = await canReviewUniversity(user, targets.universityId);
      if (!ok) return UNIVERSITY_BLOCK_MESSAGE;
      return null;
    }
    case ReviewType.ADMISSIONS: {
      if (!targets.universityId) return "University is required.";
      const ok = await canReviewAdmissions(user, targets.universityId);
      if (!ok) return ADMISSIONS_BLOCK_MESSAGE;
      return null;
    }
    case ReviewType.DORM: {
      if (!targets.dormId) return "Dorm is required.";
      const ok = await canReviewDorm(user, targets.dormId);
      if (!ok) return DORM_BLOCK_MESSAGE;
      return null;
    }
    case ReviewType.PARENT_INSIGHT:
      // Parent insight is gated by role only — no per-target connection
      // requirement. The route's existing canSubmitReviewType handles it.
      return null;
  }
}

// Exact copy from the spec, kept as exported constants so the same string
// flows through the API response, the UI block message, and any future
// admin tooling.
export const COACH_BLOCK_MESSAGE =
  "You can only review coaches from programs you played for or were verified with.";
export const PROGRAM_BLOCK_MESSAGE =
  "You can only review programs you played for, were recruited by, or were verified with.";
export const RECRUITING_BLOCK_MESSAGE =
  "Recruiting reviews are limited to programs that recruited you. Add a recruiting connection first.";
export const UNIVERSITY_BLOCK_MESSAGE =
  "You can only review schools you attended, graduated from, or verified a real admissions/campus experience with.";
export const DORM_BLOCK_MESSAGE =
  "You can only review dorms at universities you attended, graduated from, or verified a real campus experience with.";
export const ADMISSIONS_BLOCK_MESSAGE =
  "Admissions reviews are limited to universities that admitted you or that you visited. Add an admissions/campus connection first.";
