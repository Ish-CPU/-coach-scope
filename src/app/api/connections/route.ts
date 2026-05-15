import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { isAthleteTrustedRole, isRecruitRole } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { sendConnectionRequestEmail } from "@/lib/email/notifications";
import {
  AthleteConnectionStatus,
  AthleteConnectionType,
  UserRole,
} from "@prisma/client";

/**
 * Athlete ↔ Program connection endpoints.
 *
 * POST creates a PENDING connection — admin approval is what unlocks the
 * downstream review permissions. We never auto-approve here.
 *
 * GET returns the signed-in user's own connections (any status). Admin UI
 * has its own listing endpoint when that lands.
 */

const CURRENT_YEAR = new Date().getFullYear();

const submissionSchema = z.object({
  universityId: z.string().cuid(),
  schoolId: z.string().cuid().optional(),
  sport: z.string().trim().min(1).max(80),
  connectionType: z.nativeEnum(AthleteConnectionType),
  rosterUrl: z.string().url().optional().or(z.literal("")),
  recruitingProofUrl: z.string().url().optional().or(z.literal("")),
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
    .max(CURRENT_YEAR + 5)
    .optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const isAdmin = session.user.role === UserRole.ADMIN || session.user.role === UserRole.MASTER_ADMIN;

  // Athletes (current + alumni) submit their own connections. Recruits
  // submit too, but ONLY RECRUITED_BY rows — checked once we've parsed
  // the body below. Admins can submit on behalf of anyone via the admin
  // UI later.
  const isRecruit = isRecruitRole(session.user.role);
  if (!isAthleteTrustedRole(session.user.role) && !isRecruit && !isAdmin) {
    return NextResponse.json(
      { error: "Only athlete-verified or recruit-verified accounts can add program connections." },
      { status: 403 }
    );
  }

  const limited = rateLimit(req, "connection:create", {
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

  // Recruits are locked to RECRUITED_BY only — declaring CURRENT_ATHLETE
  // / ATHLETE_ALUMNI / COMMITTED / WALK_ON / TRANSFERRED_FROM would be
  // claiming insider access they shouldn't have until they enroll and
  // re-verify as a current athlete.
  if (
    isRecruit &&
    !isAdmin &&
    data.connectionType !== AthleteConnectionType.RECRUITED_BY
  ) {
    return NextResponse.json(
      {
        error:
          "Recruits can only file RECRUITED_BY connections. Commit / enroll and re-verify as a current athlete to claim insider access.",
      },
      { status: 403 }
    );
  }

  // Reject obviously-bad URLs early so admin queues stay clean.
  if (data.rosterUrl && !isSafeHttpUrl(data.rosterUrl)) {
    return NextResponse.json(
      { error: "Roster URL must be a public http(s) link." },
      { status: 400 }
    );
  }
  if (data.recruitingProofUrl && !isSafeHttpUrl(data.recruitingProofUrl)) {
    return NextResponse.json(
      { error: "Recruiting proof URL must be a public http(s) link." },
      { status: 400 }
    );
  }

  // Confirm the university actually exists — prevents typo-driven phantom rows.
  const university = await prisma.university.findUnique({
    where: { id: data.universityId },
    select: { id: true },
  });
  if (!university) {
    return NextResponse.json({ error: "Unknown university." }, { status: 400 });
  }

  // If a schoolId was supplied, verify it belongs to the same university.
  if (data.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: data.schoolId },
      select: { universityId: true, sport: true },
    });
    if (!school || school.universityId !== data.universityId) {
      return NextResponse.json(
        { error: "Program does not belong to that university." },
        { status: 400 }
      );
    }
    // Sport in the form must match the program's sport, prevents
    // "I played baseball at U of X but linked to their basketball School row".
    if (school.sport.toLowerCase() !== data.sport.toLowerCase()) {
      return NextResponse.json(
        {
          error: `Sport mismatch — program is "${school.sport}", you submitted "${data.sport}".`,
        },
        { status: 400 }
      );
    }
  }

  // Block duplicates by upserting on the unique key
  // (userId, universityId, sport, connectionType). Repeat submissions patch
  // the existing row's evidence rather than create another row.
  const existing = await prisma.athleteProgramConnection.findUnique({
    where: {
      userId_universityId_sport_connectionType: {
        userId: session.user.id,
        universityId: data.universityId,
        sport: data.sport,
        connectionType: data.connectionType,
      },
    },
    select: { id: true, status: true },
  });

  if (existing) {
    // If the prior row was REJECTED, a re-submit revives it as PENDING so
    // an admin can re-evaluate the new evidence.
    const nextStatus =
      existing.status === AthleteConnectionStatus.REJECTED
        ? AthleteConnectionStatus.PENDING
        : existing.status;

    const updated = await prisma.athleteProgramConnection.update({
      where: { id: existing.id },
      data: {
        schoolId: data.schoolId ?? null,
        rosterUrl: data.rosterUrl || null,
        recruitingProofUrl: data.recruitingProofUrl || null,
        startYear: data.startYear ?? null,
        endYear: data.endYear ?? null,
        notes: data.notes ?? null,
        status: nextStatus,
        // Reset reviewer fields when re-submitting after a rejection.
        ...(existing.status === AthleteConnectionStatus.REJECTED
          ? { reviewedAt: null, reviewedBy: null }
          : {}),
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({ id: updated.id, status: updated.status, updated: true });
  }

  const created = await prisma.athleteProgramConnection.create({
    data: {
      userId: session.user.id,
      universityId: data.universityId,
      schoolId: data.schoolId ?? null,
      sport: data.sport,
      connectionType: data.connectionType,
      rosterUrl: data.rosterUrl || null,
      recruitingProofUrl: data.recruitingProofUrl || null,
      startYear: data.startYear ?? null,
      endYear: data.endYear ?? null,
      notes: data.notes ?? null,
      status: AthleteConnectionStatus.PENDING,
    },
    select: { id: true, status: true },
  });
  // eslint-disable-next-line no-console
  console.info("[api/connections] created athlete connection", {
    connectionId: created.id,
    userId: session.user.id,
    universityId: data.universityId,
    schoolId: data.schoolId ?? null,
    sport: data.sport,
    connectionType: data.connectionType,
  });

  // Notify admins. Fire-and-forget; never blocks the user response. We
  // resolve the university name with a single small lookup so the email
  // is human-readable instead of "universityId=cuid…".
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
      kind: "athlete",
      connectionId: created.id,
      userName: me?.name ?? null,
      userEmail: me?.email ?? null,
      university: uni?.name ?? "(unknown university)",
      sport: data.sport,
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
  const rows = await prisma.athleteProgramConnection.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      university: { select: { id: true, name: true, state: true } },
      school: { select: { id: true, sport: true } },
    },
  });
  return NextResponse.json({ connections: rows });
}
