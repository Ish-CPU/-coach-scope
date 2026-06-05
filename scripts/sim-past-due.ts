/**
 * scripts/sim-past-due.ts
 *
 * Smoke-test the "past-due blocks account deletion" loophole guard
 * without going through Stripe test mode.
 *
 * Flips a single user's User.subscriptionStatus between PAST_DUE and a
 * normal value so you can:
 *   1. Sign in as that user
 *   2. Visit /account/settings → confirm the amber warning shows + the
 *      Delete button is disabled
 *   3. Flip back → confirm the button enables again
 *
 * IMPORTANT — what this does NOT test:
 *   The API endpoint's *live* Stripe re-check. The endpoint pulls real
 *   subscription state from Stripe at delete time, so if you flip the
 *   DB to PAST_DUE but the user's actual Stripe sub is ACTIVE, the API
 *   will see ACTIVE and allow the delete. The UI block is enough to
 *   smoke-test the user-facing surface. The live-Stripe layer is
 *   verified by code review of /api/account/delete/route.ts (the
 *   `effectivelyPastDue` block) — it would require a real failed
 *   payment to exercise end-to-end.
 *
 * Usage:
 *   npx tsx scripts/sim-past-due.ts --email=you@example.com --to=PAST_DUE
 *   npx tsx scripts/sim-past-due.ts --email=you@example.com --to=ACTIVE
 *   npx tsx scripts/sim-past-due.ts --email=you@example.com           # show
 */
import { PrismaClient, SubscriptionStatus } from "@prisma/client";

const prisma = new PrismaClient();

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main() {
  const email = arg("email");
  const to = arg("to");

  if (!email) {
    console.error(
      "Usage: npx tsx scripts/sim-past-due.ts --email=foo@bar.com [--to=PAST_DUE|ACTIVE|FREE|...]"
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, subscriptionStatus: true },
  });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  if (!to) {
    console.log(`\nCurrent state for ${user.email}:`);
    console.log(`  role:               ${user.role}`);
    console.log(`  subscriptionStatus: ${user.subscriptionStatus}`);
    console.log(
      `\nFlip with:  npx tsx scripts/sim-past-due.ts --email=${user.email} --to=PAST_DUE`
    );
    return;
  }

  // Validate target status against the enum.
  const valid = Object.values(SubscriptionStatus);
  if (!valid.includes(to as SubscriptionStatus)) {
    console.error(`Invalid --to=${to}. Valid: ${valid.join(", ")}`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: to as SubscriptionStatus },
  });

  console.log(`\n✓ ${user.email}: ${user.subscriptionStatus} → ${to}\n`);
  console.log(
    `Now sign in as ${user.email} and visit /account/settings to verify the UI behavior.`
  );
  console.log(
    `\nRevert with:  npx tsx scripts/sim-past-due.ts --email=${user.email} --to=${user.subscriptionStatus}\n`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
