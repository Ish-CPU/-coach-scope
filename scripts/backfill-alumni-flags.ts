/**
 * scripts/backfill-alumni-flags.ts
 *
 * Idempotent migration helper for the alumni lifecycle layer (added in the
 * lifecycle refactor). Reads existing User rows and:
 *
 *   1. Flips `isAlumni=true` on every user whose role is one of the legacy
 *      `*_ALUMNI` enum values (VERIFIED_ATHLETE_ALUMNI / VERIFIED_STUDENT_ALUMNI).
 *      These users were marked alumni by the role itself; the new boolean is
 *      the canonical signal going forward.
 *   2. Backfills `alumniSince` to the user's `updatedAt` when missing — best
 *      available proxy for "when did they become alumni" without losing
 *      precision for rows that already had it set elsewhere.
 *   3. Backfills `formerUniversityId` from the most recent APPROVED
 *      StudentUniversityConnection (or AthleteProgramConnection.universityId
 *      for athletes) when the user is alumni and the field is null. We use
 *      the most-recent-by-endYear row so a transfer chain ends at the school
 *      they actually graduated from.
 *
 * Safe to run multiple times. Run from your laptop against the prod DB:
 *
 *   DATABASE_URL='postgresql://...direct...' npm run backfill:alumni
 *
 * Add the npm script:
 *   "backfill:alumni": "tsx scripts/backfill-alumni-flags.ts"
 */
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_ALUMNI_ROLES = [
  UserRole.VERIFIED_ATHLETE_ALUMNI,
  UserRole.VERIFIED_STUDENT_ALUMNI,
] as const;

async function main() {
  // ---------------------------------------------------------------------
  // Pass 1: flip isAlumni=true for everyone with a legacy *_ALUMNI role
  // ---------------------------------------------------------------------
  const legacyAlumni = await prisma.user.findMany({
    where: { role: { in: LEGACY_ALUMNI_ROLES as unknown as UserRole[] } },
    select: {
      id: true,
      role: true,
      updatedAt: true,
      isAlumni: true,
      alumniSince: true,
      formerUniversityId: true,
      formerProgramId: true,
    },
  });
  console.log(
    `[backfill-alumni] found ${legacyAlumni.length} users with legacy alumni roles`
  );

  let flipped = 0;
  let formerSet = 0;
  for (const u of legacyAlumni) {
    if (u.isAlumni && u.alumniSince && u.formerUniversityId) continue;

    // Pull a former-school hint from the most recent APPROVED connection.
    // We try the athlete table first for athlete alumni, student table for
    // student alumni — and fall back to the other if the expected one is
    // empty (handles users who switched roles over time).
    let formerUniversityId = u.formerUniversityId;
    let formerProgramId = u.formerProgramId;

    if (!formerUniversityId) {
      if (u.role === UserRole.VERIFIED_ATHLETE_ALUMNI) {
        const ap = await prisma.athleteProgramConnection.findFirst({
          where: { userId: u.id, status: "APPROVED" },
          orderBy: [{ endYear: "desc" }, { createdAt: "desc" }],
          select: { universityId: true, schoolId: true },
        });
        if (ap) {
          formerUniversityId = ap.universityId;
          formerProgramId = ap.schoolId;
          formerSet++;
        }
      } else {
        const su = await prisma.studentUniversityConnection.findFirst({
          where: { userId: u.id, status: "APPROVED" },
          orderBy: [{ endYear: "desc" }, { createdAt: "desc" }],
          select: { universityId: true },
        });
        if (su) {
          formerUniversityId = su.universityId;
          formerSet++;
        }
      }
    }

    await prisma.user.update({
      where: { id: u.id },
      data: {
        isAlumni: true,
        alumniSince: u.alumniSince ?? u.updatedAt,
        ...(formerUniversityId && !u.formerUniversityId
          ? { formerUniversityId }
          : {}),
        ...(formerProgramId && !u.formerProgramId
          ? { formerProgramId }
          : {}),
      },
    });
    flipped++;
  }

  console.log(
    `[backfill-alumni] flipped ${flipped} rows to isAlumni=true (former-school backfilled on ${formerSet})`
  );

  // ---------------------------------------------------------------------
  // Pass 2: refuse to silently downgrade — log any user with a *current*
  // VERIFIED_ATHLETE / VERIFIED_STUDENT role whose connection history shows
  // only ATHLETE_ALUMNI / STUDENT_ALUMNI rows. Suggest review.
  // ---------------------------------------------------------------------
  const suspicious = await prisma.user.findMany({
    where: {
      role: {
        in: [UserRole.VERIFIED_ATHLETE, UserRole.VERIFIED_STUDENT],
      },
      isAlumni: false,
    },
    select: {
      id: true,
      email: true,
      role: true,
      athleteConnections: {
        where: { status: "APPROVED" },
        select: { connectionType: true },
      },
      studentConnections: {
        where: { status: "APPROVED" },
        select: { connectionType: true },
      },
    },
  });

  const dangling = suspicious.filter((u) => {
    if (u.role === UserRole.VERIFIED_ATHLETE) {
      return (
        u.athleteConnections.length > 0 &&
        u.athleteConnections.every((c) => c.connectionType === "ATHLETE_ALUMNI")
      );
    }
    return (
      u.studentConnections.length > 0 &&
      u.studentConnections.every((c) => c.connectionType === "STUDENT_ALUMNI")
    );
  });

  if (dangling.length > 0) {
    console.log(
      `[backfill-alumni] WARNING ${dangling.length} users may be alumni but role still says current:`
    );
    for (const u of dangling.slice(0, 20)) {
      console.log(`  - ${u.email} (${u.id}) role=${u.role}`);
    }
    console.log(
      `  (Review in /admin and use the lifecycle transition endpoint to flip if intended.)`
    );
  }

  console.log("[backfill-alumni] done.");
}

main()
  .catch((err) => {
    console.error("[backfill-alumni] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
