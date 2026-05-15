import { UserRole } from "@prisma/client";

/**
 * Public display name for any author (review, post, comment).
 * We never expose the user's real name publicly — every account shows up
 * as "Anonymous Verified <Tier>" so reviews can be honest without
 * retaliation. The user's identity is still stored on the row for
 * moderation and abuse prevention.
 */
export function anonymousDisplayName(role: UserRole): string {
  switch (role) {
    case UserRole.VERIFIED_ATHLETE:
      return "Anonymous Verified Athlete";
    case UserRole.VERIFIED_ATHLETE_ALUMNI:
      return "Anonymous Verified Athlete Alumni";
    case UserRole.VERIFIED_STUDENT:
      return "Anonymous Verified Student";
    case UserRole.VERIFIED_STUDENT_ALUMNI:
      return "Anonymous Verified Student Alumni";
    case UserRole.VERIFIED_PARENT:
      return "Anonymous Verified Parent";
    case UserRole.ADMIN:
      return "RateMyU Team";
    case UserRole.VIEWER:
    default:
      return "Anonymous";
  }
}

export const ANONYMITY_DISCLAIMER =
  "Posts are anonymous publicly but tied to verified accounts internally to reduce fake accounts and abuse.";
