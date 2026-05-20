import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isStudentTrustedRole } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { isAcceptableUploadOrUrl } from "@/lib/blob-token";

// See src/app/api/verification/route.ts for the helper's rationale.
const uploadUrlField = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine(
    (v) => !v || isAcceptableUploadOrUrl(v),
    "Must be a hosted URL or an uploaded file."
  );
import { sendConnectionRequestEmail } from "@/lib/email/notifications";
import {
  screenMultiple,
  FRAUD_USER_FACING_MESSAGE,
} from "@/lib/verification-fraud";
import { FraudStatus } from "@prisma/client";
import {
  StudentConnectionStatus,
  StudentConnectionType,
  UserRole,
} from "@prisma/client";

/**
 * Student ↔ University connection endpoints.
 *
 * POST creates a PENDING connection — admin approval is required before any
 * UNIVERSITY/DORM/ADMISSIONS review unlocks for that university.
 * GET returns the signed-in user's own connections.
 */

const CURRENT_YEAR = new Date().getFullYear();

const submissionSchema = z.object({
  universityId: z.string().cuid(),
  connectionType: z.nativeEnum(StudentConnectionType),
  schoolEmail: z.string().email().optional().or(z.literal("")),
  // Upload fields — proxy URL from FileUploadField or legacy absolute.
  studentIdUrl: uploadUrlField,
  proofUrl: uploadUrlField,
  startYear: z
    .number()
    .int()
    .min(1950)
    .max(CURRENT_YEAR + 1)
    .optional(),
  endYear: z
    .number()
    .int()
    .min(1950)
    .max(CURRENT_YEAR + 8)
    .optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const isAdmin = session.user.role === UserRole.ADMIN || session.user.role === UserRole.MASTER_ADMIN;
  if (!isStudentTrustedRole(session.user.role) && !isAdmin) {
    return NextResponse.json(
      { error: "Only student-verified accounts can add school connections." },
      { status: 403 }
    );
  }

  const limited = await rateLimit(req, "student-connection:create", {
    max: 20,
    windowMs: 10 * 60_000,
    identifier: session.user.id,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.studentIdUrl && !isSafeHttpUrl(data.studentIdUrl)) {
    return NextResponse.json(
      { error: "Student ID URL must be a public http(s) link." },
      { status: 400 }
    );
  }
  if (data.proofUrl && !isSafeHttpUrl(data.proofUrl)) {
    return NextResponse.json(
      { error: "Proof URL must be a public http(s) link." },
      { status: 400 }
    );
  }

  const university = await prisma.university.findUnique({
    where: { id: data.universityId },
    select: { id: true },
  });
  if (!university) {
    return NextResponse.json({ error: "Unknown university." }, { status: 400 });
  }

  // AI/fraud screen on the proof uploads BEFORE any DB writes. See
  // /api/verification + /api/connections for the rationale — same
  // pattern: DENIED short-circuits with a generic user-facing message,
  // CLEAR / REVIEW_REQUIRED proceed and the admin still has the final
  // say. `schoolEmail` is not screened (no image bytes to hash); admin
  // approval continues to gate access for student-trusted roles.
  const fraud = await screenMultiple({
    userId: session.user.id,
    urls: [data.studentIdUrl || null, data.proofUrl || null],
    targetType: "student_connection",
    targetId: null,
  });
  if (fraud?.status === FraudStatus.DENIED) {
    return NextResponse.json({ error: FRAUD_USER_FACING_MESSAGE }, { status: 422 });
  }

  // Same upsert-on-unique-key pattern as athlete connections.
  const existing = await prisma.studentUniversityConnection.findUnique({
    where: {
      userId_universityId_connectionType: {
        userId: session.user.id,
        universityId: data.universityId,
        connectionType: data.connectionType,
      },
    },
    select: { id: true, status: true },
  });

  if (existing) {
    const nextStatus =
      existing.status === StudentConnectionStatus.REJECTED
        ? StudentConnectionStatus.PENDING
        : existing.status;

    const updated = await prisma.studentUniversityConnection.update({
      where: { id: existing.id },
      data: {
        schoolEmail: data.schoolEmail || null,
        studentIdUrl: data.studentIdUrl || null,
        proofUrl: data.proofUrl || null,
        startYear: data.startYear ?? null,
        endYear: data.endYear ?? null,
        notes: data.notes ?? null,
        status: nextStatus,
        ...(existing.status === StudentConnectionStatus.REJECTED
          ? { reviewedAt: null, reviewedBy: null }
          : {}),
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({ id: updated.id, status: updated.status, updated: true });
  }

  const created = await prisma.studentUniversityConnection.create({
    data: {
      userId: session.user.id,
      universityId: data.universityId,
      connectionType: data.connectionType,
      schoolEmail: data.schoolEmail || null,
      studentIdUrl: data.studentIdUrl || null,
      proofUrl: data.proofUrl || null,
      startYear: data.startYear ?? null,
      endYear: data.endYear ?? null,
      notes: data.notes ?? null,
      status: StudentConnectionStatus.PENDING,
    },
    select: { id: true, status: true },
  });
  // eslint-disable-next-line no-console
  console.info("[api/student-connections] created student connection", {
    connectionId: created.id,
    userId: session.user.id,
    universityId: data.universityId,
    connectionType: data.connectionType,
  });

  // Notify admins. Fire-and-forget; never blocks the user response.
  void (async () => {
    const uni = await prisma.university.findUnique({
      where: { id: data.universityId },
      select: { name: true },
    });
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    await sendConnectionRequestEmail({
      kind: "student",
      connectionId: created.id,
      userName: me?.name ?? null,
      userEmail: me?.email ?? null,
      university: uni?.name ?? "(unknown university)",
      connectionType: data.connectionType,
    });
  })();

  return NextResponse.json({ id: created.id, status: created.status, created: true }, { status: 201 });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const rows = await prisma.studentUniversityConnection.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      university: { select: { id: true, name: true, state: true } },
    },
  });
  return NextResponse.json({ connections: rows });
}
