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

export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === UserRole.ADMIN;
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
  if (session.user.role === UserRole.ADMIN) return null;
  if (!isPaymentVerified(session)) return "no-subscription";
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

/** Coach + program reviews — VERIFIED_ATHLETE only. */
export function canRateCoaches(session: Session | null): boolean {
  if (!canParticipate(session)) return false;
  return (
    session?.user?.role === UserRole.VERIFIED_ATHLETE ||
    session?.user?.role === UserRole.ADMIN
  );
}

/** University + dorm reviews — VERIFIED_ATHLETE or VERIFIED_STUDENT. */
export function canRateUniversitiesAndDorms(session: Session | null): boolean {
  if (!canParticipate(session)) return false;
  return (
    session?.user?.role === UserRole.VERIFIED_ATHLETE ||
    session?.user?.role === UserRole.VERIFIED_STUDENT ||
    session?.user?.role === UserRole.ADMIN
  );
}

/** Parent insights — VERIFIED_PARENT only (parents do NOT submit numerical ratings). */
export function canSubmitParentInsight(session: Session | null): boolean {
  if (!canParticipate(session)) return false;
  return (
    session?.user?.role === UserRole.VERIFIED_PARENT ||
    session?.user?.role === UserRole.ADMIN
  );
}

/** Allowed review types this user can submit. */
export function allowedReviewTypes(session: Session | null): ReviewType[] {
  const role = session?.user?.role;
  if (!canParticipate(session)) return [];
  if (role === UserRole.ADMIN) return Object.values(ReviewType);
  if (role === UserRole.VERIFIED_ATHLETE)
    return [ReviewType.COACH, ReviewType.PROGRAM, ReviewType.UNIVERSITY, ReviewType.DORM];
  if (role === UserRole.VERIFIED_STUDENT) return [ReviewType.UNIVERSITY, ReviewType.DORM];
  if (role === UserRole.VERIFIED_PARENT) return [ReviewType.PARENT_INSIGHT];
  return [];
}

/** Validates a review type against the user's role. */
export function canSubmitReviewType(session: Session | null, type: ReviewType): boolean {
  return allowedReviewTypes(session).includes(type);
}

// ---------------------------------------------------------------------------
// Group permissions (audience-segmented)
// ---------------------------------------------------------------------------

const ROLE_TO_GROUP_TYPE: Partial<Record<UserRole, GroupType>> = {
  [UserRole.VERIFIED_ATHLETE]: GroupType.ATHLETE_GROUP,
  [UserRole.VERIFIED_STUDENT]: GroupType.STUDENT_GROUP,
  [UserRole.VERIFIED_PARENT]: GroupType.PARENT_GROUP,
};

const GROUP_TYPE_TO_ROLE: Record<GroupType, UserRole> = {
  [GroupType.ATHLETE_GROUP]: UserRole.VERIFIED_ATHLETE,
  [GroupType.STUDENT_GROUP]: UserRole.VERIFIED_STUDENT,
  [GroupType.PARENT_GROUP]: UserRole.VERIFIED_PARENT,
};

export function groupTypeForRole(role: UserRole): GroupType | null {
  return ROLE_TO_GROUP_TYPE[role] ?? null;
}

export function roleForGroupType(type: GroupType): UserRole {
  return GROUP_TYPE_TO_ROLE[type];
}

/** Can the user post / comment / vote in this specific group? */
export function canParticipateInGroup(
  session: Session | null,
  groupType: GroupType
): boolean {
  if (!canParticipate(session)) return false;
  if (session?.user?.role === UserRole.ADMIN) return true;
  return ROLE_TO_GROUP_TYPE[session!.user!.role!] === groupType;
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
  "Participation requires a verified subscription to ensure real, accountable experiences.";

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
