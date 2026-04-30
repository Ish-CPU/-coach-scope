import {
  PrismaClient,
  GroupType,
  UserRole,
  SubscriptionStatus,
  VerificationStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { PASSWORD_BCRYPT_ROUNDS } from "../src/lib/security";

const prisma = new PrismaClient();

/**
 * RateMyU seed.
 *
 * This seed ONLY creates:
 *   - Test user accounts you can sign in with locally.
 *   - Empty audience-segmented Verified Groups so the /groups page has
 *     something to render.
 *
 * It does NOT create universities, coaches, dorms, dining, facilities,
 * reviews, ratings, posts, comments, or votes. All factual public data
 * comes from CSV imports — see seed/README.md and run:
 *
 *   npm run db:import:samples
 */
async function main() {
  console.log("🌱 Seeding RateMyU...");

  const passwordHash = await bcrypt.hash("password123", PASSWORD_BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ratemyu.app" },
    update: { paymentVerified: true, role: UserRole.ADMIN },
    create: {
      email: "admin@ratemyu.app",
      name: "RateMyU Admin",
      passwordHash,
      role: UserRole.ADMIN,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  await prisma.user.upsert({
    where: { email: "athlete@ratemyu.app" },
    update: {
      role: UserRole.VERIFIED_ATHLETE,
      paymentVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
    },
    create: {
      email: "athlete@ratemyu.app",
      name: "Demo Athlete",
      passwordHash,
      role: UserRole.VERIFIED_ATHLETE,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
      sport: "Baseball",
    },
  });

  await prisma.user.upsert({
    where: { email: "student@ratemyu.app" },
    update: {
      role: UserRole.VERIFIED_STUDENT,
      paymentVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
    },
    create: {
      email: "student@ratemyu.app",
      name: "Demo Student",
      passwordHash,
      role: UserRole.VERIFIED_STUDENT,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  await prisma.user.upsert({
    where: { email: "parent@ratemyu.app" },
    update: {
      role: UserRole.VERIFIED_PARENT,
      paymentVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
    },
    create: {
      email: "parent@ratemyu.app",
      name: "Demo Parent",
      passwordHash,
      role: UserRole.VERIFIED_PARENT,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  await prisma.user.upsert({
    where: { email: "pending@ratemyu.app" },
    update: { paymentVerified: true },
    create: {
      email: "pending@ratemyu.app",
      name: "Demo Pending",
      passwordHash,
      role: UserRole.VERIFIED_STUDENT,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.PENDING,
    },
  });

  await prisma.user.upsert({
    where: { email: "viewer@ratemyu.app" },
    update: {},
    create: {
      email: "viewer@ratemyu.app",
      name: "Demo Viewer",
      passwordHash,
      role: UserRole.VIEWER,
      subscriptionStatus: SubscriptionStatus.FREE,
    },
  });

  // --- Verified Groups (one per audience, empty) ---------------------------
  const groups: { slug: string; name: string; description: string; groupType: GroupType }[] = [
    {
      slug: "athlete-lounge",
      name: "Athlete Lounge",
      description: "Verified athletes only — recovery, training, NIL, transfer portal, mindset.",
      groupType: GroupType.ATHLETE_GROUP,
    },
    {
      slug: "campus-life",
      name: "Campus Life",
      description: "Verified students only — dorm life, food, social scene, academics.",
      groupType: GroupType.STUDENT_GROUP,
    },
    {
      slug: "parent-network",
      name: "Parent Network",
      description: "Verified parents only — recruiting questions, family experience, official visits.",
      groupType: GroupType.PARENT_GROUP,
    },
  ];
  for (const g of groups) {
    const created = await prisma.group.upsert({
      where: { slug: g.slug },
      update: { groupType: g.groupType },
      create: {
        slug: g.slug,
        name: g.name,
        description: g.description,
        groupType: g.groupType,
        createdById: admin.id,
      },
    });
    await prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: admin.id, groupId: created.id } },
      update: {},
      create: { userId: admin.id, groupId: created.id, isAdmin: true },
    });
  }

  console.log("✅ Seeded users + empty groups.");
  console.log("   No reviews / ratings / posts were created — those are user-generated.");
  console.log("   To load public factual data:  npm run db:import:samples");
  console.log("");
  console.log("Test logins (password: password123):");
  console.log("  admin@ratemyu.app    -> ADMIN");
  console.log("  athlete@ratemyu.app  -> VERIFIED_ATHLETE  (paid + verified)");
  console.log("  student@ratemyu.app  -> VERIFIED_STUDENT  (paid + verified)");
  console.log("  parent@ratemyu.app   -> VERIFIED_PARENT   (paid + verified)");
  console.log("  pending@ratemyu.app  -> VERIFIED_STUDENT  (paid, NOT yet verified)");
  console.log("  viewer@ratemyu.app   -> VIEWER (free)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // UNIVERSITIES
  const universities = [
    {
      name: "University of Alabama",
      slug: "university-of-alabama",
      city: "Tuscaloosa",
      state: "AL",
      country: "USA",
      level: "NCAA Division I",
      conference: "SEC",
    },
    {
      name: "University of Georgia",
      slug: "university-of-georgia",
      city: "Athens",
      state: "GA",
      country: "USA",
      level: "NCAA Division I",
      conference: "SEC",
    },
    {
      name: "Ohio State University",
      slug: "ohio-state-university",
      city: "Columbus",
      state: "OH",
      country: "USA",
      level: "NCAA Division I",
      conference: "Big Ten",
    },
  ];

  for (const u of universities) {
    await prisma.university.upsert({
      where: { slug: u.slug },
      update: {},
      create: u,
    });
  }

  // COACHES
  const coaches = [
    {
      name: "Kalen DeBoer",
      slug: "kalen-deboer",
      sport: "Men's Football",
      role: "Head Coach",
      schoolSlug: "university-of-alabama",
    },
    {
      name: "Kirby Smart",
      slug: "kirby-smart",
      sport: "Men's Football",
      role: "Head Coach",
      schoolSlug: "university-of-georgia",
    },
  ];

  for (const c of coaches) {
    const school = await prisma.university.findUnique({
      where: { slug: c.schoolSlug },
    });

    if (!school) continue;

    await prisma.coach.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        name: c.name,
        slug: c.slug,
        sport: c.sport,
        role: c.role,
        universityId: school.id,
      },
    });
  }

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });