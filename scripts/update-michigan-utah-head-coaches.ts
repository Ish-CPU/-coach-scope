/**
 * scripts/update-michigan-utah-head-coaches.ts
 *
 * One-off coach update reflecting the 2025 hiring carousel:
 *   - Michigan hired Kyle Whittingham (formerly Utah HC) as their new HC
 *   - Utah promoted Morgan Scalley to HC after Whittingham's departure
 *
 * The previous Michigan HC (Sherrone Moore) is removed.
 * Whittingham is moved from Utah to Michigan as a fresh Coach row.
 * Scalley is created as Utah's new HC.
 *
 * Idempotent: safe to re-run. Deletes by (schoolId + exact name) — only
 * the named rows are touched, every other coach at these schools is
 * untouched.
 *
 * USAGE
 *   npx tsx scripts/update-michigan-utah-head-coaches.ts
 *
 * No --apply flag — this is a small, targeted manual update; the script
 * commits immediately. Re-runs simply no-op if the target state is
 * already reached.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CoachSwap {
  universityName: string;
  sport: string;
  removeName: string;        // Coach to delete (old HC)
  addName: string;           // Coach to create (new HC)
  addTitle: string;
  /** Free-text note for the console summary only. */
  note: string;
}

const SWAPS: CoachSwap[] = [
  {
    universityName: "University of Michigan",
    sport: "Football",
    removeName: "Sherrone Moore",
    addName: "Kyle Whittingham",
    addTitle: "Head Coach",
    note: "Michigan hired Whittingham away from Utah",
  },
  {
    universityName: "University of Utah",
    sport: "Football",
    removeName: "Kyle Whittingham",
    addName: "Morgan Scalley",
    addTitle: "Head Coach",
    note: "Utah promoted Scalley after Whittingham's departure",
  },
];

async function processSwap(swap: CoachSwap): Promise<void> {
  console.log(`\n→ ${swap.universityName} ${swap.sport}: ${swap.removeName} → ${swap.addName}`);
  console.log(`  (${swap.note})`);

  // 1. Resolve University.
  const uni = await prisma.university.findFirst({
    where: { name: swap.universityName },
    select: { id: true },
  });
  if (!uni) {
    console.log(`  ❌ University not found — skipping`);
    return;
  }

  // 2. Resolve School (football program).
  const school = await prisma.school.findUnique({
    where: { universityId_sport: { universityId: uni.id, sport: swap.sport } },
    select: { id: true },
  });
  if (!school) {
    console.log(`  ❌ ${swap.sport} program not found at ${swap.universityName} — skipping`);
    return;
  }

  // 3. Delete the old HC if present. Exact-name match so we never
  //    accidentally remove an assistant or a similarly-named coach.
  const removed = await prisma.coach.deleteMany({
    where: { schoolId: school.id, name: swap.removeName },
  });
  if (removed.count > 0) {
    console.log(`  ✓ Removed ${swap.removeName} (${removed.count} row)`);
  } else {
    console.log(`  · ${swap.removeName} not present (already removed?)`);
  }

  // 4. Upsert the new HC. Coach @@unique is (schoolId, name) so an
  //    existing row with the same name is treated as already-correct.
  const existing = await prisma.coach.findUnique({
    where: { schoolId_name: { schoolId: school.id, name: swap.addName } },
    select: { id: true },
  });
  if (existing) {
    console.log(`  · ${swap.addName} already exists — updating title`);
    await prisma.coach.update({
      where: { id: existing.id },
      data: {
        title: swap.addTitle,
        lastVerifiedAt: new Date(),
      },
    });
  } else {
    await prisma.coach.create({
      data: {
        schoolId: school.id,
        name: swap.addName,
        title: swap.addTitle,
        seasonYear: "2025-2026",
        lastVerifiedAt: new Date(),
      },
    });
    console.log(`  ✓ Created ${swap.addName} as ${swap.addTitle}`);
  }
}

async function main() {
  console.log("🏈  Michigan / Utah head-coach update");
  for (const swap of SWAPS) {
    try {
      await processSwap(swap);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌  ${swap.universityName}: ${message}`);
    }
  }
  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
