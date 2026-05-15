import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { canApproveConnections } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { StudentConnectionStatus } from "@prisma/client";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(500).optional(),
});

/** Mirror of the athlete-connection admin endpoint, scoped to students. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!canApproveConnections(session)) {
    return NextResponse.json(
      { error: "You don't have permission to approve connections." },
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

  const existing = await prisma.studentUniversityConnection.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const approving = parsed.data.action === "approve";
  const status = approving
    ? StudentConnectionStatus.APPROVED
    : StudentConnectionStatus.REJECTED;

  await prisma.studentUniversityConnection.update({
    where: { id: existing.id },
    data: {
      status,
      reviewedAt: new Date(),
      reviewedBy: session!.user.id,
      rejectionReason: approving ? null : parsed.data.rejectionReason ?? null,
    },
  });

  await logAdminAction({
    actorUserId: session!.user.id,
    action: approving
      ? AUDIT_ACTIONS.STUDENT_CONNECTION_APPROVED
      : AUDIT_ACTIONS.STUDENT_CONNECTION_REJECTED,
    targetType: "StudentUniversityConnection",
    targetId: existing.id,
    metadata: approving
      ? undefined
      : { rejectionReason: parsed.data.rejectionReason ?? null },
  });

  return NextResponse.json({ ok: true, status });
}
