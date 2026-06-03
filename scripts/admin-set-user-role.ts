/**
 * scripts/admin-set-user-role.ts
 *
 * Manual, admin-side role fix for a single user — for cases where someone
 * picked the wrong role and is stuck (e.g. paid as Student, should be
 * Athlete). Changes `role` and resets `verificationStatus` to NONE so the
 * user is routed through the correct proof flow for the new role.
 *
 * Does NOT touch the subscription — switching roles never re-charges; the
 * subscription is role-agnostic (one price for every role).
 *
 * Usage:
 *   npx tsx scripts/admin-set-user-role.ts <email> <ROLE>
 *   npx tsx scripts/admin-set-user-role.ts josephobeto5@gmail.com VERIFIED_ATHLETE
 */
import { PrismaClient, UserRole, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.argv[2]?.trim().toLowerCase();
const roleArg = process.argv[3]?.trim() as UserRole | undefined;

const SELECTABLE: UserRole[] = [
  UserRole.VERIFIED_ATHLETE,
  UserRole.VERIFIED_ATHLETE_ALUMNI,
  UserRole.VERIFIED_RECRUIT,
  UserRole.VERIFIED_STUDENT,
  UserRole.VERIFIED_STUDENT_ALUMNI,
  UserRole.VERIFIED_PARENT,
  UserRole.VIEWER,
];

async function main() {
  if (!email || !roleArg) {
    console.error("Usage: npx tsx scripts/admin-set-user-role.ts <email> <ROLE>");
    console.error("Roles:", SELECTABLE.join(", "));
    process.exit(1);
  }
  if (!SELECTABLE.includes(roleArg)) {
    console.error(`Invalid role "${roleArg}". Must be one of: ${SELECTABLE.join(", ")}`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, verificationStatus: true, subscriptionStatus: true },
  });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  console.log(`Before: ${user.email} | role=${user.role} | verif=${user.verificationStatus} | sub=${user.subscriptionStatus}`);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: roleArg,
      // Reset verification so they go through the proof flow for the NEW
      // role. Subscription is intentionally left untouched.
      verificationStatus: VerificationStatus.NONE,
    },
    select: { email: true, role: true, verificationStatus: true, subscriptionStatus: true },
  });

  console.log(`After:  ${updated.email} | role=${updated.role} | verif=${updated.verificationStatus} | sub=${updated.subscriptionStatus}`);
  console.log("Done. Subscription untouched — no re-charge.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
