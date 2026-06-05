/**
 * PATCH /api/admin/requests/[id]
 *
 * Admin action endpoint for the "Request a school" queue (ProgramRequest
 * model). Body shape:
 *   {
 *     status: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW",
 *     priorityScore?: 0..100,
 *     adminNote?: string  (max 2000)
 *   }
 *
 * Approval here does NOT auto-create the school/program — that's a
 * manual import via /admin/import. This is an explicit triage decision
 * so admins can't accidentally promote junk into the public DB.
 *
 * When the status transitions to APPROVED or REJECTED for the first
 * time (i.e. `decidedAt` was null), we send a decision email to the
 * requester. The adminNote is included verbatim — phrase it like you're
 * writing to the user, because they will read it. If the request was
 * filed anonymously (no requesterEmail), the decision still persists
 * but no email is sent.
 *
 * Audit-logged with PROGRAM_REQUEST_APPROVED / PROGRAM_REQUEST_REJECTED.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { sendProgramRequestDecisionEmail } from "@/lib/email/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "NEEDS_REVIEW"]),
  priorityScore: z.number().int().min(0).max(100).optional(),
  adminNote: z.string().trim().max(2000).optional(),
});

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { status, priorityScore, adminNote } = parsed.data;

  // Read the pre-existing row so we can detect first-time decisions
  // (don't spam the requester if an admin re-saves an already-decided
  // row with the same status) and capture the requester's email.
  const before = await prisma.programRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      decidedAt: true,
      requesterEmail: true,
      schoolName: true,
      sport: true,
    },
  });
  if (!before) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const isTerminal = status === "APPROVED" || status === "REJECTED";
  const isFirstDecision = isTerminal && before.decidedAt === null;

  // Build the update payload. Only set decidedAt / decidedById on the
  // FIRST move to a terminal status — if an admin re-saves later we
  // preserve the original decision timestamp.
  let updated;
  try {
    updated = await prisma.programRequest.update({
      where: { id: params.id },
      data: {
        status,
        ...(priorityScore !== undefined && { priorityScore }),
        // adminNote is overwritable so an admin can refine the message
        // and re-email if needed.
        ...(adminNote !== undefined && { adminNote: adminNote || null }),
        ...(isFirstDecision && {
          decidedAt: new Date(),
          decidedById: session!.user.id,
        }),
      },
      select: { id: true, status: true, priorityScore: true, adminNote: true },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }

  // Side effects: audit + email. Both fire-and-forget so a downstream
  // glitch doesn't block the admin's UI.
  if (isFirstDecision) {
    const auditAction =
      status === "APPROVED"
        ? AUDIT_ACTIONS.PROGRAM_REQUEST_APPROVED
        : AUDIT_ACTIONS.PROGRAM_REQUEST_REJECTED;
    void logAdminAction({
      actorUserId: session!.user.id,
      action: auditAction,
      targetType: "ProgramRequest",
      targetId: before.id,
      metadata: {
        schoolName: before.schoolName,
        sport: before.sport,
        requesterEmail: before.requesterEmail ?? null,
        adminNote: adminNote ?? null,
      },
    });

    if (before.requesterEmail) {
      void sendProgramRequestDecisionEmail({
        requestId: before.id,
        toEmail: before.requesterEmail,
        schoolName: before.schoolName,
        sport: before.sport,
        decision: status === "APPROVED" ? "APPROVED" : "REJECTED",
        adminNote: adminNote ?? null,
      });
    }
  }

  return NextResponse.json({ ok: true, request: updated });
}
