/**
 * scripts/create-master-admin.ts
 *
 * Idempotent seed for the platform's MASTER_ADMIN account.
 *
 * Reads:
 *   MASTER_ADMIN_EMAIL          (required)  — primary login email
 *   MASTER_ADMIN_PASSWORD       (optional)  — set/reset the master password
 *                                              (required when creating a fresh row)
 *   MASTER_ADMIN_NAME           (optional)  — display name
 *   MASTER_ADMIN_BACKUP_EMAILS  (optional)  — comma-separated recovery emails
 *
 * Behaviour:
 *   - If no user exists with MASTER_ADMIN_EMAIL: create one with role
 *     MASTER_ADMIN, adminStatus ACTIVE, and the provided password hashed in.
 *   - If a user already exists: update their role to MASTER_ADMIN, set
 *     adminStatus to ACTIVE, replace the recovery emails list, and (if a
 *     password was provided) update the password hash. Never deletes data.
 *
 * Run:
 *   npm run admin:create-master
 */
import bcrypt from "bcryptjs";
import { PrismaClient, AdminStatus, UserRole } from "@prisma/client";

function getRequiredEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing required env var ${key}.`);
    process.exit(1);
  }
  return v;
}

function getOptionalEnv(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}

function parseRecoveryEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 5);
}

const prisma = new PrismaClient();

async function main() {
  const email = getRequiredEnv("MASTER_ADMIN_EMAIL").trim().toLowerCase();
  const name = getOptionalEnv("MASTER_ADMIN_NAME") ?? "Master Admin";
  const password = getOptionalEnv("MASTER_ADMIN_PASSWORD");
  const recoveryEmails = parseRecoveryEmails(
    getOptionalEnv("MASTER_ADMIN_BACKUP_EMAILS")
  );

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: UserRole.MASTER_ADMIN,
        adminStatus: AdminStatus.ACTIVE,
        // Master admins skip the rules-acceptance flow (they're seeded out
        // of band) so stamp this on the first run AND flip the boolean
        // mirror so the staff layout's onboarding gate passes immediately.
        acceptedAdminRulesAt: existing.acceptedAdminRulesAt ?? new Date(),
        onboardingCompleted: true,
        // Replace the recovery list with whatever the env says is canonical.
        recoveryEmails,
        // Refresh the display name only when the env supplies one.
        ...(name ? { name } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: { id: true, email: true, role: true },
    });
    console.log(
      `[create-master-admin] updated ${updated.email} (${updated.id}) → MASTER_ADMIN`
    );
  } else {
    if (!passwordHash) {
      console.error(
        "MASTER_ADMIN_PASSWORD is required when seeding a brand-new master admin."
      );
      process.exit(1);
    }
    const created = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: UserRole.MASTER_ADMIN,
        adminStatus: AdminStatus.ACTIVE,
        acceptedAdminRulesAt: new Date(),
        onboardingCompleted: true,
        recoveryEmails,
      },
      select: { id: true, email: true },
    });
    console.log(
      `[create-master-admin] created MASTER_ADMIN ${created.email} (${created.id})`
    );
  }

  console.log(
    `[create-master-admin] recovery emails: ${
      recoveryEmails.length ? recoveryEmails.join(", ") : "(none)"
    }`
  );
  console.log("[create-master-admin] done.");
}

main()
  .catch((err) => {
    console.error("[create-master-admin] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
