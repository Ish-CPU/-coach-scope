import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { canApproveVerifications } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limit";
import { validateLifecycleTransition } from "@/lib/lifecycle";

/**
 * POST /api/admin/users/[id]/lifecycle
 *   {
 *     isAlumni: boolean,
 *     // when isAlumni=true:
 *     alumniSince?: ISO string | null,
 *     graduationYear?: int | null,
 *     lastRosterSeason?: int | null,
 *     formerUniversityId?: string | null,
 *     formerProgramId?: string | null,
 *     // free-form admin note recorded on the audit row
 *     note?: string,
 *   }
 *
 * Single endpoint that flips a user's lifecycle state. Used by:
 *   - The admin team page "mark alumni" / "restore current" buttons.
 *   - Bulk graduation tooling once it ships.
 *
 * Permission: any admin with `canApproveVerifications`. We re-use that
 * permission rather than carving out a new one — lifecycle transitions
 * are the same trust class as approving a verification request.
 *
 * Audit: writes one row per call (USER_MARKED_ALUMNI / USER_RESTORED_CURRENT
 * / USER_LIFECYCLE_EDITED) with before/after metadata.
 *
 * Importantly, this endpoint does NOT change `User.role`. Today the legacy
 * `VERIFIED_ATHLETE_ALUMNI` / `VERIFIED_STUDENT_ALUMNI` enum values still
 * exist; new alumni use `isAlumni=true` on top of their existing role.
 * A future cleanup task can normalize roles once the boolean is the only
 * thing downstream code reads.
 */
const schema = z.object({
  isAlumni: z.boolean(),
  alumniSince: z.string().datetime().nullable().optional(),
  graduationYear: z.number().int().nullable().optional(),
  lastRosterSeason: z.number().int().nullable().optional(),
  formerUniversityId: z.string().cuid().nullable().optional(),
  formerProgramId: z.string().cuid().nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canApproveVerifications(session)) {
    return NextResponse.json(
      { error: "You don't have permission to change lifecycle state." },
      { status: 403 }
    );
  }

  // Slow runaway scripts; the real gate is the admin perm above.
  const limited = rateLimit(req, "admin:user:lifecycle", {
    max: 30,
    windowMs: 60_000,
    identifier: session!.user.id,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      role: true,
      isAlumni: true,
      alumniSince: true,
      graduationYear: true,
      lastRosterSeason: true,
      formerUniversityId: true,
      formerProgramId: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Pure validation — fails fast with a useful message instead of writing a
  // half-valid row (e.g. alumni=true on a parent).
  const issues = validateLifecycleTransition(user, {
    isAlumni: input.isAlumni,
    graduationYear: input.graduationYear ?? null,
    lastRosterSeason: input.lastRosterSeason ?? null,
  });
  if (issues.length > 0) {
    return NextResponse.json({ error: issues.join(" ") }, { status: 400 });
  }

  const data: Record<string, unknown> = {
    isAlumni: input.isAlumni,
  };

  // alumniSince: explicit input wins; otherwise set on first transition
  // to true and clear on transition to false.
  if (input.alumniSince !== undefined) {
    data.alumniSince = input.alumniSince ? new Date(input.alumniSince) : null;
  } else if (input.isAlumni && !user.isAlumni) {
    data.alumniSince = new Date();
  } else if (!input.isAlumni && user.isAlumni) {
    data.alumniSince = null;
  }

  if (input.graduationYear !== undefined) {
    data.graduationYear = input.graduationYear;
  }
  if (input.lastRosterSeason !== undefined) {
    data.lastRosterSeason = input.lastRosterSeason;
  }
  if (input.formerUniversityId !== undefined) {
    data.formerUniversityId = input.formerUniversityId;
  }
  if (input.formerProgramId !== undefined) {
    data.formerProgramId = input.formerProgramId;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      isAlumni: true,
      alumniSince: true,
      graduationYear: true,
      lastRosterSeason: true,
      formerUniversityId: true,
      formerProgramId: true,
    },
  });

  // Pick the most specific audit action for the operation.
  const action =
    user.isAlumni === false && input.isAlumni === true
      ? AUDIT_ACTIONS.USER_MARKED_ALUMNI
      : user.isAlumni === true && input.isAlumni === false
      ? AUDIT_ACTIONS.USER_RESTORED_CURRENT
      : AUDIT_ACTIONS.USER_LIFECYCLE_EDITED;

  await logAdminAction({
    actorUserId: session!.user.id,
    action,
    targetType: "User",
    targetId: user.id,
    metadata: {
      before: {
        isAlumni: user.isAlumni,
        alumniSince: user.alumniSince,
        graduationYear: user.graduationYear,
        lastRosterSeason: user.lastRosterSeason,
        formerUniversityId: user.formerUniversityId,
        formerProgramId: user.formerProgramId,
      },
      after: updated,
      note: input.note ?? null,
      email: user.email,
      role: user.role,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}
