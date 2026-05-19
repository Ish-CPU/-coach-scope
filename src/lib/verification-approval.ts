// ---------------------------------------------------------------------------
// Verification approval side-effects
// ---------------------------------------------------------------------------
//
// Pure orchestration: given an approved VerificationRequest, apply the
// downstream changes to the user (role flip, verificationStatus, review-
// weight refresh) and, for recruit→athlete upgrades, seed an APPROVED
// insider AthleteProgramConnection so the user instantly unlocks
// program-scoped review permissions.
//
// Shared by:
//   - /api/admin/verifications/[id]   (admin clicks Approve)
//   - /api/verification               (multi-proof auto-approval path)
//
// SAFETY:
//   - Caller is responsible for updating the VerificationRequest row's
//     status field. This helper only touches the *side-effects* of
//     approval so the two callers can stamp `reviewedBy` differently
//     ("admin id" vs "auto-approval system marker").
//   - Idempotent in the sense that re-running on an already-APPROVED row
//     produces no-op updates — the role flip only fires when newRole
//     differs from current role, and the connection upsert ignores
//     pre-existing matches by unique constraint.
//   - Runs inside a caller-supplied Prisma transaction so the parent
//     row update + these side-effects either all commit or all roll back.

import {
  AthleteConnectionStatus,
  AthleteConnectionType,
  UserRole,
  VerificationStatus,
  type VerificationRequest,
  type User,
  type Prisma,
} from "@prisma/client";
import { weightForRole } from "@/lib/review-weighting";

/**
 * Minimal request shape the helper needs. We accept this loose subset so
 * callers don't have to refetch with a full include — both paths already
 * have most of these fields in hand.
 */
type RequestForApproval = Pick<
  VerificationRequest,
  | "id"
  | "userId"
  | "targetRole"
  | "sport"
  | "universityId"
  | "universityName"
  | "schoolId"
  | "rosterUrl"
> & {
  user: Pick<User, "role">;
};

interface Options {
  /**
   * Marker stamped on auto-created rows (the upgrade connection's
   * `reviewedBy` + the verification request's `reviewedBy` when the
   * caller chooses to update via this helper). Pass the admin's id for
   * admin actions; pass null for the auto-approval path — `null` causes
   * the upgrade connection note to read "(auto-approval)".
   */
  actorUserId: string | null;
}

interface Result {
  /** True if user.role actually changed during approval. */
  roleChanged: boolean;
  /** The role the user ends up with after approval (may equal prior role). */
  finalRole: UserRole;
  /** True if a recruit→athlete upgrade auto-connect was attempted. */
  attemptedUpgradeConnect: boolean;
}

export async function applyVerificationApproval(
  tx: Prisma.TransactionClient,
  request: RequestForApproval,
  options: Options
): Promise<Result> {
  // Decide post-approval role. Same matrix as the original admin handler:
  //   1. Free VIEWER → whatever role they verified for.
  //   2. VERIFIED_RECRUIT → VERIFIED_ATHLETE / VERIFIED_ATHLETE_ALUMNI
  //      when targetRole flags an upgrade.
  //   3. Otherwise keep the current role (never demote here).
  const isUpgrade =
    request.user.role === UserRole.VERIFIED_RECRUIT &&
    (request.targetRole === UserRole.VERIFIED_ATHLETE ||
      request.targetRole === UserRole.VERIFIED_ATHLETE_ALUMNI);

  let finalRole: UserRole = request.user.role;
  if (
    request.user.role === UserRole.VIEWER &&
    request.targetRole !== UserRole.VIEWER &&
    request.targetRole !== UserRole.ADMIN
  ) {
    finalRole = request.targetRole;
  } else if (isUpgrade) {
    finalRole = request.targetRole;
  }
  const roleChanged = finalRole !== request.user.role;

  await tx.user.update({
    where: { id: request.userId },
    data: {
      verificationStatus: VerificationStatus.VERIFIED,
      role: finalRole,
    },
  });

  // Backfill review weights for ANY existing reviews this user authored
  // — weights are role-derived and the role just changed.
  if (roleChanged) {
    await tx.review.updateMany({
      where: { authorId: request.userId },
      data: { weight: weightForRole(finalRole) },
    });
  }

  // Recruit→athlete upgrade auto-connect. Best-effort: if the request
  // names a real university (by id or by name), seed an APPROVED insider
  // AthleteProgramConnection so the user unlocks program-scoped reviews
  // without a second admin pass. Skip silently otherwise.
  if (isUpgrade && request.sport) {
    const connectionType =
      request.targetRole === UserRole.VERIFIED_ATHLETE_ALUMNI
        ? AthleteConnectionType.ATHLETE_ALUMNI
        : AthleteConnectionType.CURRENT_ATHLETE;

    let uni: { id: string; schools: { id: string; sport: string }[] } | null = null;
    if (request.universityId) {
      uni = await tx.university.findUnique({
        where: { id: request.universityId },
        select: { id: true, schools: { select: { id: true, sport: true } } },
      });
    }
    if (!uni && request.universityName) {
      uni = await tx.university.findFirst({
        where: { name: { equals: request.universityName, mode: "insensitive" } },
        select: { id: true, schools: { select: { id: true, sport: true } } },
      });
    }

    if (uni) {
      const matchingSchool =
        (request.schoolId &&
          uni.schools.find((s) => s.id === request.schoolId)) ||
        uni.schools.find(
          (s) => s.sport.toLowerCase() === request.sport!.toLowerCase()
        );

      await tx.athleteProgramConnection.upsert({
        where: {
          userId_universityId_sport_connectionType: {
            userId: request.userId,
            universityId: uni.id,
            sport: request.sport,
            connectionType,
          },
        },
        create: {
          userId: request.userId,
          universityId: uni.id,
          schoolId: matchingSchool?.id ?? null,
          sport: request.sport,
          connectionType,
          status: AthleteConnectionStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: options.actorUserId,
          notes: options.actorUserId
            ? `Auto-created on recruit→athlete upgrade (verification request ${request.id}).`
            : `Auto-created on multi-proof auto-approval (verification request ${request.id}).`,
          rosterUrl: request.rosterUrl,
        },
        update: {
          status: AthleteConnectionStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: options.actorUserId,
          schoolId: matchingSchool?.id ?? undefined,
        },
      });
    }

    return { roleChanged, finalRole, attemptedUpgradeConnect: true };
  }

  return { roleChanged, finalRole, attemptedUpgradeConnect: false };
}
