import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { canApproveVerifications } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import {
  AthleteConnectionStatus,
  AthleteConnectionType,
  UserRole,
  VerificationRequestStatus,
  VerificationStatus,
} from "@prisma/client";
import { weightForRole } from "@/lib/review-weighting";

const schema = z.object({
  // "needs_more_info" pings the user to add more evidence without
  // approving or rejecting outright. Their `verificationStatus` stays
  // PENDING so they keep a clear path back to /verification.
  action: z.enum(["approve", "reject", "needs_more_info"]),
  rejectionReason: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!canApproveVerifications(session)) {
    return NextResponse.json(
      { error: "You don't have permission to action verification requests." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const request = await prisma.verificationRequest.findUnique({
    where: { id: params.id },
    include: { user: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const action = parsed.data.action;
  const approving = action === "approve";

  // Map admin action → request status + downstream user.verificationStatus.
  let nextRequestStatus: VerificationRequestStatus;
  let nextUserStatus: VerificationStatus;
  switch (action) {
    case "approve":
      nextRequestStatus = VerificationRequestStatus.APPROVED;
      nextUserStatus = VerificationStatus.VERIFIED;
      break;
    case "reject":
      nextRequestStatus = VerificationRequestStatus.REJECTED;
      nextUserStatus = VerificationStatus.REJECTED;
      break;
    case "needs_more_info":
    default:
      nextRequestStatus = VerificationRequestStatus.NEEDS_MORE_INFO;
      // Keep the user in PENDING so the verification page still routes them
      // through the right form to add more evidence.
      nextUserStatus = VerificationStatus.PENDING;
      break;
  }

  // Resolve the post-approval role. We only ever promote — never demote —
  // and the promotion paths are explicit:
  //   1. Free VIEWER → whatever role they verified for (initial signup
  //      after checkout, existing behavior).
  //   2. VERIFIED_RECRUIT → VERIFIED_ATHLETE / VERIFIED_ATHLETE_ALUMNI
  //      when the request's targetRole reflects an upgrade. This is the
  //      bridge that lets a recruit become a current athlete on the same
  //      account without re-signing up — prior reviews, RECRUITED_BY
  //      connections, and subscription all stay attached.
  // Anything else keeps the current role.
  let newRole = request.user.role;
  const isUpgrade =
    approving &&
    request.user.role === UserRole.VERIFIED_RECRUIT &&
    (request.targetRole === UserRole.VERIFIED_ATHLETE ||
      request.targetRole === UserRole.VERIFIED_ATHLETE_ALUMNI);

  if (
    approving &&
    request.user.role === UserRole.VIEWER &&
    request.targetRole !== UserRole.VIEWER &&
    request.targetRole !== UserRole.ADMIN
  ) {
    newRole = request.targetRole;
  } else if (isUpgrade) {
    newRole = request.targetRole;
  }

  // For recruit-to-athlete upgrades we additionally auto-create an
  // APPROVED insider connection from the request's sport + university
  // fields so the upgraded user doesn't have to repeat the connection
  // dance. CURRENT_ATHLETE for promotions to VERIFIED_ATHLETE,
  // ATHLETE_ALUMNI for transfer recruits landing in the alumni surface.
  // Only fires when we can resolve the university to a real row.
  const connectionType =
    request.targetRole === UserRole.VERIFIED_ATHLETE_ALUMNI
      ? AthleteConnectionType.ATHLETE_ALUMNI
      : AthleteConnectionType.CURRENT_ATHLETE;

  await prisma.$transaction(async (tx) => {
    await tx.verificationRequest.update({
      where: { id: request.id },
      data: {
        status: nextRequestStatus,
        reviewedAt: new Date(),
        reviewedBy: session!.user.id,
        // The "rejectionReason" column doubles as the admin note for
        // NEEDS_MORE_INFO so the user sees the same string back regardless
        // of which terminal-or-pending state they land in.
        rejectionReason: approving ? null : parsed.data.rejectionReason ?? null,
      },
    });
    await tx.user.update({
      where: { id: request.userId },
      data: { verificationStatus: nextUserStatus, role: newRole },
    });

    if (approving && newRole !== request.user.role) {
      await tx.review.updateMany({
        where: { authorId: request.userId },
        data: { weight: weightForRole(newRole) },
      });
    }

    // Upgrade auto-connect — best-effort. If the request named a real
    // university we'll seed an APPROVED insider AthleteProgramConnection
    // so the user immediately unlocks coach + program reviews for that
    // school. We never overwrite a pre-existing row (unique key on
    // userId+universityId+sport+connectionType ensures that).
    if (isUpgrade && request.sport) {
      // Resolve the university two ways, in priority order:
      //   1. `request.universityId` — set by the shared combobox at
      //      submit time. Cheapest + most reliable.
      //   2. `request.universityName` — fuzzy case-insensitive match
      //      against the University.name column. Covers legacy rows
      //      that pre-date the combobox + any free-form text entry.
      let uni: {
        id: string;
        schools: { id: string; sport: string }[];
      } | null = null;
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
          // Prefer the explicit schoolId from the submission, then fall
          // back to a (uni, sport) lookup on the just-fetched program list.
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
            reviewedBy: session!.user.id,
            notes: `Auto-created on recruit→athlete upgrade (verification request ${request.id}).`,
            rosterUrl: request.rosterUrl,
          },
          update: {
            // If a PENDING row already exists for the same target,
            // promote it to APPROVED rather than create a duplicate.
            status: AthleteConnectionStatus.APPROVED,
            reviewedAt: new Date(),
            reviewedBy: session!.user.id,
            schoolId: matchingSchool?.id ?? undefined,
          },
        });
      }
    }
  });

  await logAdminAction({
    actorUserId: session!.user.id,
    action:
      action === "approve"
        ? AUDIT_ACTIONS.VERIFICATION_APPROVED
        : action === "reject"
        ? AUDIT_ACTIONS.VERIFICATION_REJECTED
        : AUDIT_ACTIONS.VERIFICATION_NEEDS_MORE_INFO,
    targetType: "VerificationRequest",
    targetId: request.id,
    metadata: {
      userId: request.userId,
      targetRole: request.targetRole,
      priorRole: request.user.role,
      isUpgrade,
      rejectionReason: parsed.data.rejectionReason ?? null,
    },
  });

  return NextResponse.json({ ok: true, status: nextRequestStatus, upgraded: isUpgrade });
}
