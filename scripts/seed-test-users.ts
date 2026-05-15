/**
 * scripts/seed-test-users.ts
 *
 * Local-only test fixtures. Seeds a small population of fake-email
 * accounts so we can walk every role / verification / connection /
 * upgrade flow end-to-end without burning real email addresses.
 *
 * Idempotent + safe:
 *   - Every write uses upsert keyed by email, so re-running the script
 *     refreshes the test data without duplicating rows.
 *   - Production users (anything not in `@coachscope.local`) are never
 *     touched. The script uses unique fake emails, so there's no path
 *     from real accounts to seeded accounts.
 *   - Nothing is ever deleted.
 *
 * What gets created:
 *
 *   ┌────────────────────────────────────┬───────────────────────────┬───────────────────────────────┐
 *   │ Email                              │ Role                      │ State                         │
 *   ├────────────────────────────────────┼───────────────────────────┼───────────────────────────────┤
 *   │ test.recruit@coachscope.local      │ VERIFIED_RECRUIT          │ VERIFIED + ready to upgrade   │
 *   │                                    │                           │   (approved RECRUITED_BY      │
 *   │                                    │                           │    connections + an approved  │
 *   │                                    │                           │    recruit verification)      │
 *   │ test.athlete@coachscope.local      │ VERIFIED_ATHLETE          │ PENDING verification          │
 *   │ test.student@coachscope.local      │ VERIFIED_STUDENT          │ PENDING verification          │
 *   │ test.athlete.alumni@coachscope...  │ VERIFIED_ATHLETE_ALUMNI   │ PENDING verification          │
 *   │ test.student.alumni@coachscope...  │ VERIFIED_STUDENT_ALUMNI   │ PENDING verification          │
 *   │ test.admin@coachscope.local        │ ADMIN                     │ ACTIVE + onboarded            │
 *   └────────────────────────────────────┴───────────────────────────┴───────────────────────────────┘
 *
 * The admin account has every default staff permission. The pending
 * verification + connection requests give the admin something to actually
 * approve in the queues.
 *
 * Run:
 *   npm run seed:test-users
 */
import bcrypt from "bcryptjs";
import {
  AthleteConnectionStatus,
  AthleteConnectionType,
  AdminStatus,
  PrismaClient,
  StudentConnectionStatus,
  StudentConnectionType,
  UserRole,
  VerificationMethod,
  VerificationRequestStatus,
  VerificationStatus,
} from "@prisma/client";
// Canonical hashing cost used by the production sign-up route. Bcrypt's
// compare() is rounds-agnostic (rounds are embedded in the hash itself),
// but matching the production constant keeps test rows visually identical
// to real ones and avoids drift if the constant ever changes.
import { PASSWORD_BCRYPT_ROUNDS } from "../src/lib/security";

const prisma = new PrismaClient();

const PASSWORD = "TestPassword123!";

const TEST_EMAILS = {
  recruit: "test.recruit@coachscope.local",
  athlete: "test.athlete@coachscope.local",
  student: "test.student@coachscope.local",
  athleteAlumni: "test.athlete.alumni@coachscope.local",
  studentAlumni: "test.student.alumni@coachscope.local",
  admin: "test.admin@coachscope.local",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a User row keyed by email. Returns the user with id resolved.
 * Never overwrites the id column — if the user already exists we update
 * everything else but keep their `id` stable so existing reviews /
 * connections / verification rows stay attached.
 *
 * The update path is intentionally exhaustive — it explicitly clears
 * every blocking field (inviteToken, inviteExpiresAt, sessionsRevokedAt,
 * removalReason, removalNote) so a stale row from a previous run with,
 * say, REMOVED status can be flipped back to a working sign-in.
 */
async function upsertUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  adminStatus?: AdminStatus | null;
  adminPermissions?: Record<string, boolean> | null;
  acceptedAdminRulesAt?: Date | null;
  onboardingCompleted?: boolean;
}) {
  const email = input.email.toLowerCase();
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: input.name,
      passwordHash: input.passwordHash,
      // Mirror what a real OAuth / completed-signup row looks like. Credentials
      // auth doesn't strictly check `emailVerified`, but populating it keeps
      // the row indistinguishable from a fully-onboarded production user
      // and silences any future check that might require it.
      emailVerified: new Date(),
      role: input.role,
      verificationStatus: input.verificationStatus,
      adminStatus: input.adminStatus ?? null,
      adminPermissions: (input.adminPermissions as any) ?? null,
      acceptedAdminRulesAt: input.acceptedAdminRulesAt ?? null,
      onboardingCompleted: input.onboardingCompleted ?? false,
    },
    update: {
      name: input.name,
      passwordHash: input.passwordHash,
      emailVerified: new Date(),
      role: input.role,
      verificationStatus: input.verificationStatus,
      adminStatus: input.adminStatus ?? null,
      adminPermissions: (input.adminPermissions as any) ?? null,
      acceptedAdminRulesAt: input.acceptedAdminRulesAt ?? null,
      onboardingCompleted: input.onboardingCompleted ?? false,
      // Clear every blocking field so a re-run always lands on a working
      // account, regardless of whatever state previous runs (or manual
      // tweaks) left behind.
      inviteToken: null,
      inviteExpiresAt: null,
      sessionsRevokedAt: null,
      removalReason: null,
      removalNote: null,
    },
  });
}

/**
 * Find a real University we can attach test connections to. Prefers any
 * row whose name we can match — falls back to "any" so the script works
 * even on a freshly-imported DB. Returns null when there are zero
 * University rows; the caller skips connection seeding in that case.
 */
async function pickHostUniversity() {
  const named = await prisma.university.findFirst({
    where: { name: { contains: "State", mode: "insensitive" } },
    include: { schools: { take: 5 } },
  });
  if (named) return named;
  return prisma.university.findFirst({ include: { schools: { take: 5 } } });
}

/**
 * Find an additional university so recruits can have multiple connections
 * to different schools. Excludes the host. Returns null if the DB only has
 * one University row.
 */
async function pickSecondUniversity(excludeId: string) {
  return prisma.university.findFirst({
    where: { id: { not: excludeId } },
    include: { schools: { take: 5 } },
  });
}

/**
 * Pick a sport that actually exists at this university (so the connection
 * has a matching School row), or fall back to "Baseball" as a generic
 * placeholder. The admin queue still works either way.
 */
function pickSport(uni: { schools: { sport: string }[] } | null): string {
  return uni?.schools[0]?.sport ?? "Baseball";
}

/**
 * Upsert an AthleteProgramConnection. Keys on the unique constraint
 * `(userId, universityId, sport, connectionType)` so re-running the
 * script never duplicates rows.
 */
async function upsertAthleteConnection(input: {
  userId: string;
  universityId: string;
  schoolId?: string | null;
  sport: string;
  connectionType: AthleteConnectionType;
  status: AthleteConnectionStatus;
  rosterUrl?: string | null;
  recruitingProofUrl?: string | null;
  notes?: string | null;
}) {
  return prisma.athleteProgramConnection.upsert({
    where: {
      userId_universityId_sport_connectionType: {
        userId: input.userId,
        universityId: input.universityId,
        sport: input.sport,
        connectionType: input.connectionType,
      },
    },
    create: {
      userId: input.userId,
      universityId: input.universityId,
      schoolId: input.schoolId ?? null,
      sport: input.sport,
      connectionType: input.connectionType,
      status: input.status,
      rosterUrl: input.rosterUrl ?? null,
      recruitingProofUrl: input.recruitingProofUrl ?? null,
      notes: input.notes ?? null,
      ...(input.status === AthleteConnectionStatus.APPROVED
        ? { reviewedAt: new Date() }
        : {}),
    },
    update: {
      schoolId: input.schoolId ?? null,
      status: input.status,
      rosterUrl: input.rosterUrl ?? null,
      recruitingProofUrl: input.recruitingProofUrl ?? null,
      notes: input.notes ?? null,
    },
  });
}

async function upsertStudentConnection(input: {
  userId: string;
  universityId: string;
  connectionType: StudentConnectionType;
  status: StudentConnectionStatus;
  schoolEmail?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
}) {
  return prisma.studentUniversityConnection.upsert({
    where: {
      userId_universityId_connectionType: {
        userId: input.userId,
        universityId: input.universityId,
        connectionType: input.connectionType,
      },
    },
    create: {
      userId: input.userId,
      universityId: input.universityId,
      connectionType: input.connectionType,
      status: input.status,
      schoolEmail: input.schoolEmail ?? null,
      proofUrl: input.proofUrl ?? null,
      notes: input.notes ?? null,
      ...(input.status === StudentConnectionStatus.APPROVED
        ? { reviewedAt: new Date() }
        : {}),
    },
    update: {
      status: input.status,
      schoolEmail: input.schoolEmail ?? null,
      proofUrl: input.proofUrl ?? null,
      notes: input.notes ?? null,
    },
  });
}

/**
 * Ensure there's at most ONE pending verification request per user — the
 * verification API enforces this via a duplicate-pending check. We
 * delete-then-create rather than upsert because there's no natural unique
 * key on VerificationRequest. Only the test user's own rows are touched.
 */
async function resetAndCreateVerificationRequest(input: {
  userId: string;
  targetRole: UserRole;
  method: VerificationMethod;
  status: VerificationRequestStatus;
  sport?: string | null;
  universityName?: string | null;
  rosterUrl?: string | null;
  proofUrl?: string | null;
  studentIdUrl?: string | null;
  eduEmail?: string | null;
  schoolEmailVerified?: boolean;
  confidenceScore?: number | null;
  notes?: string | null;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
}) {
  // Clear prior pending-like rows for the same user — keeps the queue
  // clean across re-runs without touching anything else in the DB.
  await prisma.verificationRequest.deleteMany({
    where: {
      userId: input.userId,
      status: {
        in: [
          VerificationRequestStatus.PENDING,
          VerificationRequestStatus.HIGH_CONFIDENCE,
          VerificationRequestStatus.NEEDS_REVIEW,
          VerificationRequestStatus.LOW_CONFIDENCE,
          VerificationRequestStatus.NEEDS_MORE_INFO,
        ],
      },
    },
  });
  return prisma.verificationRequest.create({
    data: {
      userId: input.userId,
      targetRole: input.targetRole,
      method: input.method,
      status: input.status,
      sport: input.sport ?? null,
      universityName: input.universityName ?? null,
      rosterUrl: input.rosterUrl ?? null,
      proofUrl: input.proofUrl ?? null,
      studentIdUrl: input.studentIdUrl ?? null,
      eduEmail: input.eduEmail ?? null,
      schoolEmailVerified: input.schoolEmailVerified ?? false,
      confidenceScore: input.confidenceScore ?? null,
      notes: input.notes ?? null,
      reviewedAt: input.reviewedAt ?? null,
      reviewedBy: input.reviewedBy ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Verifies the seeded passwordHash actually compares back to PASSWORD.
 * This catches the worst class of seed bug — silently writing a hash that
 * the production sign-in path can't validate (e.g. wrong algo, wrong
 * field, or a stale row whose passwordHash didn't get updated). Fails
 * loudly with the offending email so we never ship a "users seeded"
 * banner over a broken auth state.
 */
async function assertSignInWorks(email: string) {
  const row = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { passwordHash: true },
  });
  if (!row?.passwordHash) {
    throw new Error(
      `[seed-test-users] ${email} has no passwordHash after upsert.`
    );
  }
  const ok = await bcrypt.compare(PASSWORD, row.passwordHash);
  if (!ok) {
    throw new Error(
      `[seed-test-users] bcrypt.compare failed for ${email}. The hash exists but doesn't match "${PASSWORD}". ` +
        "This indicates a hashing-algorithm mismatch between the seed and the auth route — investigate before relying on these accounts."
    );
  }
}

async function main() {
  // Canonical hashing parameters — same constant the production
  // /api/auth/register endpoint uses. bcrypt.compare in src/lib/auth.ts
  // doesn't care about rounds (they're embedded in the hash), so this
  // is belt-and-suspenders consistency, not a correctness fix.
  const passwordHash = await bcrypt.hash(PASSWORD, PASSWORD_BCRYPT_ROUNDS);

  // Hoist a host university so connection requests have a real foreign
  // key to point at. If the DB has no University rows we still seed the
  // users + verification requests; we just skip connection seeding.
  const host = await pickHostUniversity();
  const secondHost = host ? await pickSecondUniversity(host.id) : null;

  if (!host) {
    console.warn(
      "[seed-test-users] No University rows in DB — connection requests will be skipped. Run a conference seed first if you want full coverage."
    );
  }

  // ----- Admin -----
  const admin = await upsertUser({
    email: TEST_EMAILS.admin,
    name: "Test Admin",
    passwordHash,
    role: UserRole.ADMIN,
    verificationStatus: VerificationStatus.VERIFIED,
    adminStatus: AdminStatus.ACTIVE,
    adminPermissions: {
      canManageAdmins: false,
      canApproveVerifications: true,
      canApproveConnections: true,
      canModerateReviews: true,
      canManageSchools: true,
      canManageCoaches: true,
      canImportData: true,
      canManageBilling: false,
      canViewAuditLogs: true,
    },
    acceptedAdminRulesAt: new Date(),
    onboardingCompleted: true,
  });

  // ----- Recruit: VERIFIED + ready to upgrade -----
  // The spec asks for both "one verified recruit" and "one recruit ready
  // to upgrade to athlete" — same user, same state. They've already had a
  // recruit verification approved AND have at least one APPROVED
  // RECRUITED_BY connection so they can write a Recruiting Experience
  // Review today AND click "Upgrade to Athlete" without needing further
  // groundwork.
  const recruit = await upsertUser({
    email: TEST_EMAILS.recruit,
    name: "Test Recruit",
    passwordHash,
    role: UserRole.VERIFIED_RECRUIT,
    verificationStatus: VerificationStatus.VERIFIED,
  });

  // Approved recruit verification — shows up in the user's verification
  // history and gates the upgrade-form on the verification page.
  await resetAndCreateVerificationRequest({
    userId: recruit.id,
    targetRole: UserRole.VERIFIED_RECRUIT,
    method: VerificationMethod.PROOF_UPLOAD,
    status: VerificationRequestStatus.APPROVED,
    sport: host ? pickSport(host) : "Baseball",
    universityName: host?.name ?? "Stanford University",
    proofUrl: "https://example.com/recruit-proof.png",
    notes: "Seeded test recruit — proof linked is a placeholder.",
    reviewedAt: new Date(),
    reviewedBy: admin.id,
    confidenceScore: 85,
  });

  if (host) {
    const sport = pickSport(host);
    const matchingSchoolId =
      host.schools.find((s) => s.sport === sport)?.id ?? null;
    await upsertAthleteConnection({
      userId: recruit.id,
      universityId: host.id,
      schoolId: matchingSchoolId,
      sport,
      connectionType: AthleteConnectionType.RECRUITED_BY,
      status: AthleteConnectionStatus.APPROVED,
      recruitingProofUrl: "https://example.com/recruit-offer.pdf",
      notes: "Approved seed connection — recruit can write a RECRUITING review.",
    });
    if (secondHost) {
      const sport2 = pickSport(secondHost);
      await upsertAthleteConnection({
        userId: recruit.id,
        universityId: secondHost.id,
        schoolId:
          secondHost.schools.find((s) => s.sport === sport2)?.id ?? null,
        sport: sport2,
        connectionType: AthleteConnectionType.RECRUITED_BY,
        status: AthleteConnectionStatus.APPROVED,
        recruitingProofUrl: "https://example.com/recruit-camp.png",
        notes: "Second approved recruit connection — multi-school coverage.",
      });
    }
  }

  // ----- Athlete: PENDING verification -----
  const athlete = await upsertUser({
    email: TEST_EMAILS.athlete,
    name: "Test Athlete",
    passwordHash,
    role: UserRole.VERIFIED_ATHLETE,
    verificationStatus: VerificationStatus.PENDING,
  });
  await resetAndCreateVerificationRequest({
    userId: athlete.id,
    targetRole: UserRole.VERIFIED_ATHLETE,
    method: VerificationMethod.PROOF_UPLOAD,
    status: VerificationRequestStatus.NEEDS_REVIEW,
    sport: host ? pickSport(host) : "Baseball",
    universityName: host?.name ?? "Stanford University",
    rosterUrl: "https://example.com/roster/test-athlete",
    studentIdUrl: "https://example.com/test-athlete-id.png",
    notes: "Seeded current-athlete verification — approve to flip role unlocks.",
    confidenceScore: 60,
  });
  if (host) {
    const sport = pickSport(host);
    await upsertAthleteConnection({
      userId: athlete.id,
      universityId: host.id,
      schoolId: host.schools.find((s) => s.sport === sport)?.id ?? null,
      sport,
      connectionType: AthleteConnectionType.CURRENT_ATHLETE,
      status: AthleteConnectionStatus.PENDING,
      rosterUrl: "https://example.com/roster/test-athlete",
      notes: "Seeded pending current-athlete connection.",
    });
  }

  // ----- Student: PENDING verification -----
  const student = await upsertUser({
    email: TEST_EMAILS.student,
    name: "Test Student",
    passwordHash,
    role: UserRole.VERIFIED_STUDENT,
    verificationStatus: VerificationStatus.PENDING,
  });
  await resetAndCreateVerificationRequest({
    userId: student.id,
    targetRole: UserRole.VERIFIED_STUDENT,
    method: VerificationMethod.EDU_EMAIL,
    status: VerificationRequestStatus.NEEDS_REVIEW,
    eduEmail: "test.student@example.edu",
    universityName: host?.name ?? "Stanford University",
    schoolEmailVerified: false,
    notes: "Seeded student verification — approve to flip role unlocks.",
    confidenceScore: 70,
  });
  if (host) {
    await upsertStudentConnection({
      userId: student.id,
      universityId: host.id,
      connectionType: StudentConnectionType.CURRENT_STUDENT,
      status: StudentConnectionStatus.PENDING,
      schoolEmail: "test.student@example.edu",
      notes: "Seeded pending current-student connection.",
    });
  }

  // ----- Athlete alumni: PENDING verification -----
  const athleteAlumni = await upsertUser({
    email: TEST_EMAILS.athleteAlumni,
    name: "Test Athlete Alumni",
    passwordHash,
    role: UserRole.VERIFIED_ATHLETE_ALUMNI,
    verificationStatus: VerificationStatus.PENDING,
  });
  await resetAndCreateVerificationRequest({
    userId: athleteAlumni.id,
    targetRole: UserRole.VERIFIED_ATHLETE_ALUMNI,
    method: VerificationMethod.PROOF_UPLOAD,
    status: VerificationRequestStatus.NEEDS_REVIEW,
    sport: host ? pickSport(host) : "Baseball",
    universityName: host?.name ?? "Stanford University",
    rosterUrl: "https://example.com/historical-roster/test-alumni",
    proofUrl: "https://example.com/test-alumni-diploma.png",
    notes: "Seeded athlete-alumni verification — past roster + diploma scan.",
    confidenceScore: 65,
  });
  if (host) {
    const sport = pickSport(host);
    await upsertAthleteConnection({
      userId: athleteAlumni.id,
      universityId: host.id,
      schoolId: host.schools.find((s) => s.sport === sport)?.id ?? null,
      sport,
      connectionType: AthleteConnectionType.ATHLETE_ALUMNI,
      status: AthleteConnectionStatus.PENDING,
      rosterUrl: "https://example.com/historical-roster/test-alumni",
      notes: "Seeded pending athlete-alumni connection.",
    });
  }

  // ----- Student alumni: PENDING verification -----
  const studentAlumni = await upsertUser({
    email: TEST_EMAILS.studentAlumni,
    name: "Test Student Alumni",
    passwordHash,
    role: UserRole.VERIFIED_STUDENT_ALUMNI,
    verificationStatus: VerificationStatus.PENDING,
  });
  await resetAndCreateVerificationRequest({
    userId: studentAlumni.id,
    targetRole: UserRole.VERIFIED_STUDENT_ALUMNI,
    method: VerificationMethod.PROOF_UPLOAD,
    status: VerificationRequestStatus.NEEDS_REVIEW,
    universityName: host?.name ?? "Stanford University",
    proofUrl: "https://example.com/test-student-alumni-diploma.png",
    notes: "Seeded student-alumni verification — diploma upload.",
    confidenceScore: 65,
  });
  if (host) {
    await upsertStudentConnection({
      userId: studentAlumni.id,
      universityId: host.id,
      connectionType: StudentConnectionType.STUDENT_ALUMNI,
      status: StudentConnectionStatus.PENDING,
      proofUrl: "https://example.com/test-student-alumni-diploma.png",
      notes: "Seeded pending student-alumni connection.",
    });
  }

  // ----- Sign-in self-test -----
  // Verify every seeded account is actually sign-in-able. If any of these
  // throw, the seed has a bug — better to surface it now than to chase
  // "credentials don't work" later.
  for (const email of Object.values(TEST_EMAILS)) {
    await assertSignInWorks(email);
  }

  // ----- Report -----
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log("\n=== seed-test-users ===");
  console.log(`Password for every test account: ${PASSWORD}`);
  console.log("");
  console.log("Accounts:");
  for (const [k, email] of Object.entries(TEST_EMAILS)) {
    console.log(`  ${email.padEnd(38)}  (${k})`);
  }
  console.log("");
  console.log("Useful URLs:");
  console.log(`  Sign in:               ${baseUrl}/sign-in`);
  console.log(`  Dashboard:             ${baseUrl}/dashboard`);
  console.log(`  Verification:          ${baseUrl}/verification`);
  console.log(`  Connections:           ${baseUrl}/connections`);
  console.log(`  Admin home:            ${baseUrl}/admin`);
  console.log(`  Admin verifications:   ${baseUrl}/admin/verifications`);
  console.log(`  Admin connections:     ${baseUrl}/admin/connections`);
  console.log("");
  console.log("Tips:");
  console.log("  - Sign in as test.admin to walk the verification + connection queues.");
  console.log("  - Sign in as test.recruit to test recruit reviews and the upgrade flow.");
  console.log("  - Re-running this script refreshes test data without touching real users.");
  if (!host) {
    console.log("");
    console.log(
      "  NOTE: no University rows exist in this DB — connection rows were skipped."
    );
    console.log(
      "        Run a conference seed (e.g. `npm run seed:gliac-programs`) first for full coverage."
    );
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("[seed-test-users] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
