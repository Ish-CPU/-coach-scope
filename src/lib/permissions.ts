import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  GroupType,
  ReviewType,
  SubscriptionStatus,
  UserRole,
  VerificationStatus,
} from "@prisma/client";
import {
  isUserAlumni,
  isUserCurrent,
  lifecycleAudienceAllows,
} from "@/lib/lifecycle";

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export async function getSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

export function isPaymentVerified(session: Session | null): boolean {
  return Boolean(session?.user?.paymentVerified) || isActive(session);
}

export function isActive(session: Session | null): boolean {
  return session?.user?.subscriptionStatus === SubscriptionStatus.ACTIVE;
}

/**
 * Either ADMIN or MASTER_ADMIN. The platform's existing per-page guards all
 * route through this so promoting a user to MASTER_ADMIN automatically
 * grants every place that previously gated on `isAdmin`. Granular admin
 * permissions live in `src/lib/admin-permissions.ts`.
 */
export function isAdmin(session: Session | null): boolean {
  const r = session?.user?.role;
  return r === UserRole.ADMIN || r === UserRole.MASTER_ADMIN;
}

export function isVerifiedAthlete(session: Session | null): boolean {
  return session?.user?.role === UserRole.VERIFIED_ATHLETE;
}

export function isVerifiedStudent(session: Session | null): boolean {
  return session?.user?.role === UserRole.VERIFIED_STUDENT;
}

export function isVerifiedParent(session: Session | null): boolean {
  return session?.user?.role === UserRole.VERIFIED_PARENT;
}

// ---------------------------------------------------------------------------
// Role equivalence groupings — single source of truth
// ---------------------------------------------------------------------------
//
// Adding a new "athlete-like" or "student-like" role here is the only change
// downstream permission helpers need. Every per-action check below funnels
// through `isAthleteTrustedRole` / `isStudentTrustedRole`, so future code
// that adds (say) `VERIFIED_ATHLETE_PRO` only needs to extend `ATHLETE_ROLES`
// to inherit every athlete permission automatically.

export const ATHLETE_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.VERIFIED_ATHLETE,
  UserRole.VERIFIED_ATHLETE_ALUMNI,
]);

export const STUDENT_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.VERIFIED_STUDENT,
  UserRole.VERIFIED_STUDENT_ALUMNI,
]);

/** True for `VERIFIED_ATHLETE` and any other future athlete-equivalent role. */
export function isAthleteTrustedRole(role: UserRole | undefined | null): boolean {
  return !!role && ATHLETE_ROLES.has(role);
}

/** True for `VERIFIED_STUDENT` and any other future student-equivalent role. */
export function isStudentTrustedRole(role: UserRole | undefined | null): boolean {
  return !!role && STUDENT_ROLES.has(role);
}

/**
 * Recruit role — prospective athlete being recruited but not yet enrolled.
 * Intentionally NOT in `ATHLETE_ROLES`: they can only write RECRUITING
 * reviews, not COACH / PROGRAM / UNIVERSITY / DORM / ADMISSIONS. Once they
 * commit and verify as a current athlete, the role flips to
 * VERIFIED_ATHLETE and the full athlete-trusted scope kicks in.
 */
export function isRecruitRole(role: UserRole | undefined | null): boolean {
  return role === UserRole.VERIFIED_RECRUIT;
}

/** Session-level wrapper for athlete equivalence (kept for back-compat). */
export function isVerifiedAthleteOrAlumni(session: Session | null): boolean {
  return isAthleteTrustedRole(session?.user?.role);
}

/** Session-level wrapper for student equivalence. */
export function isVerifiedStudentOrAlumni(session: Session | null): boolean {
  return isStudentTrustedRole(session?.user?.role);
}

/**
 * Lifecycle helpers — re-exported so callers don't have to import from two
 * places. `isAlumniSession` reads the canonical `isAlumni` boolean (with a
 * fallback to the legacy *_ALUMNI roles for sessions issued before the
 * flag landed). `isCurrentSession` is its inverse.
 */
export function isAlumniSession(session: Session | null): boolean {
  return isUserAlumni(session?.user);
}

export function isCurrentSession(session: Session | null): boolean {
  return isUserCurrent(session?.user);
}

export function isRoleVerified(session: Session | null): boolean {
  return session?.user?.verificationStatus === VerificationStatus.VERIFIED;
}

// ---------------------------------------------------------------------------
// Two-layer gates
// ---------------------------------------------------------------------------

/**
 * Reason why a user cannot participate, or null when they can.
 * Drives every UI gate / upgrade prompt.
 */
export type ParticipationGate =
  | null
  | "not-signed-in"
  | "no-subscription"
  | "role-not-verified"
  | "wrong-role";

export function whyCannotParticipate(session: Session | null): ParticipationGate {
  if (!session?.user) return "not-signed-in";
  if (isAdmin(session)) return null;
  // MVP: payment gating is disabled (Stripe not wired). Re-enable by
  // restoring the `if (!isPaymentVerified(session)) return "no-subscription";`
  // check above the role check once subscriptions ship.
  void isPaymentVerified;
  if (!isRoleVerified(session)) return "role-not-verified";
  return null;
}

/** Generic "can do anything that requires a verified subscription". */
export function canParticipate(session: Session | null): boolean {
  return whyCannotParticipate(session) === null;
}

// ---------------------------------------------------------------------------
// Per-action gates
// ---------------------------------------------------------------------------

/** Coach + program reviews — any athlete-trusted role (current or alumni). */
export function canRateCoaches(session: Session | null): boolean {
  if (!canParticipate(session)) return false;
  const role = session?.user?.role;
  return isAthleteTrustedRole(role) || isAdmin(session);
}

/** University + dorm reviews — any athlete- or student-trusted role. */
export function canRateUniversitiesAndDorms(session: Session | null): boolean {
  if (!canParticipate(session)) return false;
  const role = session?.user?.role;
  return (
    isAthleteTrustedRole(role) ||
    isStudentTrustedRole(role) ||
    isAdmin(session)
  );
}

/** Parent insights — VERIFIED_PARENT only (parents do NOT submit numerical ratings). */
export function canSubmitParentInsight(session: Session | null): boolean {
  if (!canParticipate(session)) return false;
  return session?.user?.role === UserRole.VERIFIED_PARENT || isAdmin(session);
}

/** Allowed review types this user can submit. */
export function allowedReviewTypes(session: Session | null): ReviewType[] {
  const role = session?.user?.role;
  if (!canParticipate(session)) return [];
  if (isAdmin(session)) return Object.values(ReviewType);
  if (isAthleteTrustedRole(role))
    return [
      ReviewType.COACH,
      ReviewType.PROGRAM,
      ReviewType.UNIVERSITY,
      ReviewType.DORM,
      // RECRUITING is athlete-trusted — even though connection-permissions.ts
      // does the per-target check, role-level access is granted to athletes
      // (current + alumni) who were also recruited.
      ReviewType.RECRUITING,
    ];
  // Verified Recruits get exactly one review type: RECRUITING. They have
  // no first-hand experience of coaches, programs, dorms, or campus life
  // until they enroll and re-verify — so the type universe is locked
  // tightly here. Per-target gate in connection-permissions.ts further
  // restricts which schools they can submit against (must have an APPROVED
  // RECRUITED_BY connection to that school).
  if (isRecruitRole(role)) return [ReviewType.RECRUITING];
  if (isStudentTrustedRole(role))
    return [
      ReviewType.UNIVERSITY,
      ReviewType.DORM,
      // ADMISSIONS is the student-side parallel of RECRUITING — even though
      // connection-permissions.ts does the per-target check, role-level
      // access is student-trusted.
      ReviewType.ADMISSIONS,
    ];
  if (role === UserRole.VERIFIED_PARENT) return [ReviewType.PARENT_INSIGHT];
  return [];
}

/** Validates a review type against the user's role. */
export function canSubmitReviewType(session: Session | null, type: ReviewType): boolean {
  return allowedReviewTypes(session).includes(type);
}

// ---------------------------------------------------------------------------
// Group permissions
// ---------------------------------------------------------------------------
//
// Two generations of group taxonomy live in the schema:
//   - Audience types (ATHLETE_GROUP / STUDENT_GROUP / PARENT_GROUP) — old.
//     Permission keyed off ROLE_TO_GROUP_TYPE: role must match the audience.
//   - Entity types (UNIVERSITY / PROGRAM / COACH / PARENT / RECRUITING) — new.
//     Permission keyed off the group's `visibility` enum + a per-type role
//     set. PUBLIC means anyone signed-in can post; VERIFIED_ONLY means
//     they need a verified role; PRIVATE is members-only.
//
// `canParticipateInGroup` keeps the old single-arg signature for
// back-compat with callers that only have a `groupType` (e.g. the dashboard
// "go to your role's group" CTA). New callers should use
// `canPostInGroup({ type, visibility })` so the visibility check applies.

const ROLE_TO_GROUP_TYPE: Partial<Record<UserRole, GroupType>> = {
  // Athletes (current + alumni) share the athlete community.
  [UserRole.VERIFIED_ATHLETE]: GroupType.ATHLETE_GROUP,
  [UserRole.VERIFIED_ATHLETE_ALUMNI]: GroupType.ATHLETE_GROUP,
  // Students (current + alumni) share the student community.
  [UserRole.VERIFIED_STUDENT]: GroupType.STUDENT_GROUP,
  [UserRole.VERIFIED_STUDENT_ALUMNI]: GroupType.STUDENT_GROUP,
  [UserRole.VERIFIED_PARENT]: GroupType.PARENT_GROUP,
};

const GROUP_TYPE_TO_ROLE: Partial<Record<GroupType, UserRole>> = {
  [GroupType.ATHLETE_GROUP]: UserRole.VERIFIED_ATHLETE,
  [GroupType.STUDENT_GROUP]: UserRole.VERIFIED_STUDENT,
  [GroupType.PARENT_GROUP]: UserRole.VERIFIED_PARENT,
};

export function groupTypeForRole(role: UserRole): GroupType | null {
  return ROLE_TO_GROUP_TYPE[role] ?? null;
}

export function roleForGroupType(type: GroupType): UserRole | undefined {
  return GROUP_TYPE_TO_ROLE[type];
}

// Per-entity-type role sets. Empty array means "any verified role can post"
// (used by UNIVERSITY / COACH which are open communities).
const ENTITY_TYPE_POSTING_ROLES: Partial<Record<GroupType, ReadonlySet<UserRole>>> = {
  // PROGRAM groups skew athlete (current + alumni). We allow students /
  // parents too — they're tied to the same university and frequently
  // have first-hand context.
  [GroupType.PROGRAM]: new Set<UserRole>([
    UserRole.VERIFIED_ATHLETE,
    UserRole.VERIFIED_ATHLETE_ALUMNI,
    UserRole.VERIFIED_STUDENT,
    UserRole.VERIFIED_STUDENT_ALUMNI,
    UserRole.VERIFIED_PARENT,
    UserRole.VERIFIED_RECRUIT,
  ]),
  // PARENT groups are parent-only.
  [GroupType.PARENT]: new Set<UserRole>([UserRole.VERIFIED_PARENT]),
  // RECRUITING groups: recruits + athletes (who lived through it) + parents.
  [GroupType.RECRUITING]: new Set<UserRole>([
    UserRole.VERIFIED_RECRUIT,
    UserRole.VERIFIED_ATHLETE,
    UserRole.VERIFIED_ATHLETE_ALUMNI,
    UserRole.VERIFIED_PARENT,
  ]),
  // UNIVERSITY + COACH intentionally absent → "any verified role".
};

/**
 * Legacy single-arg gate. Only meaningful for audience-typed groups
 * (ATHLETE_GROUP / STUDENT_GROUP / PARENT_GROUP); for entity types it
 * conservatively returns false so callers are forced to pass the full
 * group via `canPostInGroup` (which knows about visibility).
 */
export function canParticipateInGroup(
  session: Session | null,
  groupType: GroupType
): boolean {
  if (!canParticipate(session)) return false;
  if (isAdmin(session)) return true;
  if (!GROUP_TYPE_TO_ROLE[groupType]) return false;
  return ROLE_TO_GROUP_TYPE[session!.user!.role!] === groupType;
}

export interface GroupAccessShape {
  groupType: GroupType;
  /** Legacy 3-state field; new code reads `accessMode` instead. */
  visibility?: "PUBLIC" | "VERIFIED_ONLY" | "PRIVATE" | null;
  /**
   * 4-state access mode (PUBLIC_VIEW_PUBLIC_POST /
   * PUBLIC_VIEW_VERIFIED_POST / VERIFIED_ONLY / PRIVATE). Preferred
   * source of truth — see src/lib/groups-moderation.ts for the mapping
   * that collapses legacy `visibility` into this when callers only have
   * the older field.
   */
  accessMode?:
    | "PUBLIC_VIEW_PUBLIC_POST"
    | "PUBLIC_VIEW_VERIFIED_POST"
    | "VERIFIED_ONLY"
    | "PRIVATE"
    | null;
  /** Pass `true` when the user has a GroupMembership row for this group. */
  isMember?: boolean;
  /**
   * Lifecycle audience gate, applied AFTER the accessMode check. When
   * omitted (or "CURRENT_AND_ALUMNI") this is a no-op. CURRENT_ONLY blocks
   * users with isAlumni=true; ALUMNI_ONLY blocks users without it. Admins
   * always bypass. Default exists on every new Group row.
   */
  lifecycleAudience?: "CURRENT_ONLY" | "ALUMNI_ONLY" | "CURRENT_AND_ALUMNI" | null;
}

/**
 * Can the user view this group's posts? Reads `accessMode` first;
 * falls back to legacy `visibility` for older rows that haven't been
 * migrated. PUBLIC_* modes → anyone; VERIFIED_ONLY → signed-in +
 * role-verified; PRIVATE → members + admins only.
 */
export function canViewGroup(
  session: Session | null,
  group: GroupAccessShape
): boolean {
  if (isAdmin(session)) return true;
  const mode = group.accessMode ?? legacyVisibilityToMode(group.visibility);
  // Lifecycle gate runs BEFORE the access mode for non-public groups so
  // we don't briefly leak a "you're verified but wrong lifecycle" hint.
  // Public-read modes still honor the gate so an alumni-only forum stays
  // hidden from a current user even when the access mode is public.
  if (
    group.lifecycleAudience &&
    group.lifecycleAudience !== "CURRENT_AND_ALUMNI" &&
    !lifecycleAudienceAllows(session?.user, group.lifecycleAudience)
  ) {
    return false;
  }
  if (mode === "PUBLIC_VIEW_PUBLIC_POST" || mode === "PUBLIC_VIEW_VERIFIED_POST")
    return true;
  if (mode === "PRIVATE") return !!group.isMember;
  // VERIFIED_ONLY
  if (!session?.user) return false;
  return isRoleVerified(session);
}

/**
 * Can the user post / comment / vote in this group? Combines:
 *   - the participation gate (signed-in + role-verified per mode)
 *   - access mode (PRIVATE → member required; VERIFIED_POST → verified)
 *   - per-entity-type role allowlist (PROGRAM/PARENT/RECRUITING)
 *   - legacy audience-type role match (ATHLETE_GROUP / STUDENT_GROUP /
 *     PARENT_GROUP) for backward compatibility
 */
export function canPostInGroup(
  session: Session | null,
  group: GroupAccessShape
): boolean {
  if (isAdmin(session)) return true;
  // Sign-in is the floor for all post modes — even
  // PUBLIC_VIEW_PUBLIC_POST requires authentication so we have an
  // identity to attach to the post.
  if (!session?.user) return false;
  const mode = group.accessMode ?? legacyVisibilityToMode(group.visibility);
  // Lifecycle audience gate. Admin bypass above covers staff; here we
  // refuse posts from users in the wrong lifecycle bucket so an alumnus
  // can't post in a current-only roster room and vice versa.
  if (
    group.lifecycleAudience &&
    group.lifecycleAudience !== "CURRENT_AND_ALUMNI" &&
    !lifecycleAudienceAllows(session.user, group.lifecycleAudience)
  ) {
    return false;
  }
  if (mode === "PRIVATE" && !group.isMember) return false;
  // Verification floor depends on mode:
  //   PUBLIC_VIEW_PUBLIC_POST  — signed-in is enough
  //   anything else            — must clear the participation gate
  //                              (role-verified)
  if (mode !== "PUBLIC_VIEW_PUBLIC_POST" && !canParticipate(session))
    return false;

  const role = session.user.role;
  // Legacy audience types — must match the audience exactly.
  if (GROUP_TYPE_TO_ROLE[group.groupType]) {
    return ROLE_TO_GROUP_TYPE[role] === group.groupType;
  }
  // Entity types — open if the type isn't restricted, otherwise check
  // the per-type role allowlist.
  const allowed = ENTITY_TYPE_POSTING_ROLES[group.groupType];
  if (!allowed) return true;
  return allowed.has(role);
}

function legacyVisibilityToMode(
  v: GroupAccessShape["visibility"]
):
  | "PUBLIC_VIEW_PUBLIC_POST"
  | "PUBLIC_VIEW_VERIFIED_POST"
  | "VERIFIED_ONLY"
  | "PRIVATE" {
  if (v === "PRIVATE") return "PRIVATE";
  if (v === "VERIFIED_ONLY") return "VERIFIED_ONLY";
  return "PUBLIC_VIEW_PUBLIC_POST";
}

/** Free + signed-in users get a preview; paid+verified see everything. */
export function canFullyAccessGroup(
  session: Session | null,
  groupType: GroupType
): boolean {
  return canParticipateInGroup(session, groupType);
}

// ---------------------------------------------------------------------------
// Free-user messaging (used by upgrade prompts)
// ---------------------------------------------------------------------------

export const PARTICIPATION_REQUIRED_MESSAGE =
  "Participation requires a verified role so MyUniversityVerified stays honest and accountable.";

export function describeGate(
  gate: ParticipationGate,
  context?: { groupType?: GroupType; reviewType?: ReviewType }
): string {
  switch (gate) {
    case null:
      return "";
    case "not-signed-in":
      return "Sign in to continue.";
    case "no-subscription":
      return PARTICIPATION_REQUIRED_MESSAGE;
    case "role-not-verified":
      return "Verify your role to unlock ratings, posts, and votes.";
    case "wrong-role":
      if (context?.groupType === GroupType.ATHLETE_GROUP)
        return "Only Verified Athletes can post here.";
      if (context?.groupType === GroupType.STUDENT_GROUP)
        return "Only Verified Students can post here.";
      if (context?.groupType === GroupType.PARENT_GROUP)
        return "Only Verified Parents can post here.";
      if (context?.reviewType === ReviewType.COACH || context?.reviewType === ReviewType.PROGRAM)
        return "Only Verified Athletes can rate coaches.";
      if (context?.reviewType === ReviewType.PARENT_INSIGHT)
        return "Only Verified Parents can submit parent insights.";
      return "Your role does not allow this action.";
  }
}

// Back-compat aliases — older imports
export const canPostReviews = canParticipate;
export const canPostInGroups = canParticipate;
export const canVoteOnPosts = canParticipate;
export const canFullyAccessGroups = canParticipate;
export const whyCannotPost = whyCannotParticipate;
