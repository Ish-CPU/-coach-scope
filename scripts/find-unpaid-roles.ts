/**
 * scripts/find-unpaid-roles.ts
 *
 * Lists every user whose role claims a verified/paid identity (ATHLETE,
 * STUDENT, PARENT, RECRUIT, *_ALUMNI) but who has NO active or trialing
 * subscription — the leak the /api/onboarding/role paywall now blocks.
 *
 * What counts as "no subscription":
 *   FREE     — never subscribed
 *   EXPIRED  — trial/sub ended
 *   PAST_DUE — payment failing (kept here too — view-only per the gate)
 *
 * Honored statuses (NOT listed):
 *   ACTIVE / TRIALING / CANCELED (within the period)
 *
 * Modes:
 *   npx tsx scripts/find-unpaid-roles.ts             # report only
 *   npx tsx scripts/find-unpaid-roles.ts --demote    # demote ALL to VIEWER
 *   npx tsx scripts/find-unpaid-roles.ts --demote --email=foo@bar.com
 *                                                    # demote a specific user
 *
 * Demote means: set role → VIEWER, verificationStatus → NONE. They keep
 * their account; they just lose the unjustified verified-role label and
 * any verification badge. They can re-claim by paying like everyone else.
 *
 * Admin accounts (ADMIN / MASTER_ADMIN) are excluded — they have role
 * not tied to subscription state.
 */
import {
  PrismaClient,
  SubscriptionStatus,
  UserRole,
  VerificationStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const DEMOTE = process.argv.includes("--demote");
const emailArg = process.argv.find((a) => a.startsWith("--email="));
const TARGET_EMAIL = emailArg ? emailArg.slice("--email=".length).toLowerCase() : null;

const UNPAID_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.FREE,
  SubscriptionStatus.EXPIRED,
  SubscriptionStatus.PAST_DUE,
];

const PAID_ROLES: UserRole[] = [
  UserRole.VERIFIED_ATHLETE,
  UserRole.VERIFIED_ATHLETE_ALUMNI,
  UserRole.VERIFIED_RECRUIT,
  UserRole.VERIFIED_STUDENT,
  UserRole.VERIFIED_STUDENT_ALUMNI,
  UserRole.VERIFIED_PARENT,
];

async function main() {
  console.log(`\n🔎  Unpaid-role audit — ${DEMOTE ? "DEMOTE mode" : "REPORT-ONLY"}\n`);

  const offenders = await prisma.user.findMany({
    where: {
      role: { in: PAID_ROLES },
      subscriptionStatus: { in: UNPAID_STATUSES },
      ...(TARGET_EMAIL ? { email: TARGET_EMAIL } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      verificationStatus: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (offenders.length === 0) {
    console.log("✅  No unpaid users holding a verified role. Nothing to do.\n");
    return;
  }

  console.log(`Found ${offenders.length} user(s):\n`);
  for (const u of offenders) {
    console.log(
      `  · ${u.email.padEnd(36)} role=${u.role.padEnd(26)} verif=${u.verificationStatus.padEnd(9)} sub=${u.subscriptionStatus.padEnd(9)} stripeCust=${u.stripeCustomerId ? "yes" : "no "}  joined=${u.createdAt.toISOString().slice(0, 10)}`
    );
  }
  console.log("");

  if (!DEMOTE) {
    console.log("Run again with --demote to fix. Add --email=foo@bar.com to target one user.\n");
    return;
  }

  console.log(`Demoting ${offenders.length} user(s) → role=VIEWER, verificationStatus=NONE…\n`);
  for (const u of offenders) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        role: UserRole.VIEWER,
        verificationStatus: VerificationStatus.NONE,
      },
    });
    console.log(`  ✓  ${u.email}`);
  }
  console.log(`\nDone. Demoted ${offenders.length} user(s).\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
