import {
  PrismaClient,
  Division,
  GroupType,
  ReviewType,
  UserRole,
  SubscriptionStatus,
  VerificationStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { SPORTS } from "../src/lib/sports";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Coach Scope...");

  // --- Users ----------------------------------------------------------------
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@coachscope.app" },
    update: { paymentVerified: true },
    create: {
      email: "admin@coachscope.app",
      name: "Coach Scope Admin",
      passwordHash,
      role: UserRole.ADMIN,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  const athlete = await prisma.user.upsert({
    where: { email: "athlete@coachscope.app" },
    update: {
      role: UserRole.VERIFIED_ATHLETE,
      paymentVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
    },
    create: {
      email: "athlete@coachscope.app",
      name: "Jordan Athlete",
      passwordHash,
      role: UserRole.VERIFIED_ATHLETE,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
      sport: "Baseball",
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@coachscope.app" },
    update: {
      role: UserRole.VERIFIED_STUDENT,
      paymentVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
    },
    create: {
      email: "student@coachscope.app",
      name: "Riley Student",
      passwordHash,
      role: UserRole.VERIFIED_STUDENT,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  const parent = await prisma.user.upsert({
    where: { email: "parent@coachscope.app" },
    update: {
      role: UserRole.VERIFIED_PARENT,
      paymentVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
    },
    create: {
      email: "parent@coachscope.app",
      name: "Pat Parent",
      passwordHash,
      role: UserRole.VERIFIED_PARENT,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  // A user mid-flow: paid but not yet role-verified, useful for testing the gate.
  await prisma.user.upsert({
    where: { email: "pending@coachscope.app" },
    update: { paymentVerified: true },
    create: {
      email: "pending@coachscope.app",
      name: "Quinn Pending",
      passwordHash,
      role: UserRole.VERIFIED_STUDENT,
      paymentVerified: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      verificationStatus: VerificationStatus.PENDING,
    },
  });

  await prisma.user.upsert({
    where: { email: "viewer@coachscope.app" },
    update: {},
    create: {
      email: "viewer@coachscope.app",
      name: "Sam Viewer",
      passwordHash,
      role: UserRole.VIEWER,
      subscriptionStatus: SubscriptionStatus.FREE,
    },
  });

  // --- Cleanup: drop any School (and their Coaches via cascade) for sports
  // that are no longer supported. Same for User.sport free-text values.
  const removed = await prisma.school.deleteMany({
    where: { sport: { notIn: [...SPORTS] } },
  });
  if (removed.count > 0) {
    console.log(`🧹 Removed ${removed.count} School row(s) on unsupported sports.`);
  }
  await prisma.user.updateMany({
    where: { sport: { not: null, notIn: [...SPORTS] } },
    data: { sport: null },
  });

  // --- Universities + Schools + Coaches + Dorms -----------------------------
  // Only sports from src/lib/sports.ts are allowed.
  const universities = [
    {
      name: "Stanford University",
      city: "Stanford",
      state: "CA",
      description: "Private research university known for academics and athletics.",
      sports: ["Baseball", "Softball", "Football", "Men's Basketball", "Women's Basketball", "Men's Soccer", "Women's Soccer"],
      dorms: ["Wilbur Hall", "Stern Hall", "Toyon Hall"],
    },
    {
      name: "University of Texas at Austin",
      city: "Austin",
      state: "TX",
      description: "Large public flagship known for Longhorn athletics.",
      sports: ["Baseball", "Softball", "Football", "Men's Basketball", "Women's Basketball", "Women's Soccer"],
      dorms: ["Jester West", "Kinsolving", "San Jacinto Residence Hall"],
    },
    {
      name: "University of Michigan",
      city: "Ann Arbor",
      state: "MI",
      description: "Public Big Ten powerhouse.",
      sports: ["Football", "Baseball", "Softball", "Men's Basketball", "Women's Basketball", "Women's Soccer"],
      dorms: ["South Quad", "Bursley Hall", "Markley Hall"],
    },
    {
      name: "Duke University",
      city: "Durham",
      state: "NC",
      description: "Private ACC school with elite basketball.",
      sports: ["Football", "Men's Basketball", "Women's Basketball", "Men's Soccer", "Women's Soccer"],
      dorms: ["Edens Quad", "Kilgo Quad", "Crowell Quad"],
    },
  ];

  const coachNamesBySport: Record<string, string[]> = {
    Football: ["Troy Taylor", "Steve Sarkisian", "Sherrone Moore", "Manny Diaz"],
    Baseball: ["David Esquer", "David Pierce", "Erik Bakich"],
    Softball: ["Jessica Allister", "Mike White", "Bonnie Tholl"],
    "Men's Basketball": ["Kyle Smith", "Rodney Terry", "Dusty May", "Jon Scheyer"],
    "Women's Basketball": ["Kate Paye", "Vic Schaefer", "Kim Barnes Arico", "Kara Lawson"],
    "Men's Soccer": ["Jeremy Gunn", "John Kerr"],
    "Women's Soccer": ["Paul Ratcliffe", "Angela Kelly", "Jennifer Klein", "Robbie Church"],
  };

  for (const u of universities) {
    const uni = await prisma.university.upsert({
      where: { name: u.name },
      update: {},
      create: {
        name: u.name,
        city: u.city,
        state: u.state,
        description: u.description,
      },
    });

    for (const sport of u.sports) {
      const school = await prisma.school.upsert({
        where: { universityId_sport: { universityId: uni.id, sport } },
        update: {},
        create: {
          universityId: uni.id,
          sport,
          division: Division.D1,
          conference: u.name.includes("Texas")
            ? "SEC"
            : u.name.includes("Michigan")
            ? "Big Ten"
            : u.name.includes("Duke")
            ? "ACC"
            : "ACC",
        },
      });

      for (const coachName of coachNamesBySport[sport] ?? []) {
        await prisma.coach.upsert({
          where: { id: `${school.id}:${coachName}` },
          update: {},
          create: {
            id: `${school.id}:${coachName}`,
            name: coachName,
            title: "Head Coach",
            schoolId: school.id,
            bio: `${coachName} leads the ${u.name} ${sport} program.`,
          },
        });
      }
    }

    for (const dormName of u.dorms) {
      await prisma.dorm.upsert({
        where: { universityId_name: { universityId: uni.id, name: dormName } },
        update: {},
        create: {
          name: dormName,
          universityId: uni.id,
          description: `${dormName} at ${u.name}.`,
        },
      });
    }
  }

  // --- Sample reviews -------------------------------------------------------
  const stanford = await prisma.university.findUniqueOrThrow({ where: { name: "Stanford University" } });
  const stanfordBaseball = await prisma.school.findUniqueOrThrow({
    where: { universityId_sport: { universityId: stanford.id, sport: "Baseball" } },
  });
  const esquer = await prisma.coach.findFirstOrThrow({
    where: { schoolId: stanfordBaseball.id, name: "David Esquer" },
  });
  const wilbur = await prisma.dorm.findUniqueOrThrow({
    where: { universityId_name: { universityId: stanford.id, name: "Wilbur Hall" } },
  });

  await prisma.review.deleteMany({
    where: {
      authorId: { in: [athlete.id, student.id, parent.id] },
      reviewType: { in: [ReviewType.COACH, ReviewType.UNIVERSITY, ReviewType.DORM, ReviewType.PARENT_INSIGHT] },
    },
  });

  await prisma.review.createMany({
    data: [
      {
        authorId: athlete.id,
        reviewType: ReviewType.COACH,
        coachId: esquer.id,
        schoolId: stanfordBaseball.id,
        title: "Honest recruiter, great development",
        body: "Coach was upfront about my role and the program delivered on player development promises. Training table is solid; weight room is top tier.",
        ratings: {
          recruitingHonesty: 5,
          communication: 5,
          playerTreatment: 4,
          development: 5,
          trustworthiness: 5,
          teamCulture: 5,
          nilOpportunity: 3,
          foodRating: 4,
          facilityRating: 5,
          overallRating: 5,
        },
        overall: 4.6,
        weight: 2.0,
      },
      {
        authorId: parent.id,
        reviewType: ReviewType.PARENT_INSIGHT,
        coachId: esquer.id,
        schoolId: stanfordBaseball.id,
        title: "Solid program for families",
        body: "Communication with parents was open and consistent. Recruiting was honest.",
        ratings: {
          coachCommunication: 5,
          recruitingHonesty: 5,
          programEnvironment: 4,
          athleteSupport: 4,
          overallRating: 4.5,
        },
        overall: 4.5,
        weight: 1.25,
      },
      {
        authorId: student.id,
        reviewType: ReviewType.UNIVERSITY,
        universityId: stanford.id,
        title: "Beautiful campus, demanding academics",
        body: "World-class facilities and academic support, but a heavy course load. Food on campus is decent; safety has never been a concern.",
        ratings: {
          dormQuality: 4,
          campusSafety: 5,
          socialLife: 4,
          foodQuality: 4,
          facilities: 5,
          academicSupport: 5,
          overallExperience: 4.5,
        },
        overall: 4.5,
        weight: 1.25,
      },
      {
        authorId: athlete.id,
        reviewType: ReviewType.DORM,
        dormId: wilbur.id,
        title: "Great freshman dorm energy",
        body: "Tons of community, average rooms, decent food nearby.",
        ratings: {
          dormQuality: 4,
          campusSafety: 5,
          socialLife: 5,
          foodQuality: 3,
          facilities: 4,
          academicSupport: 4,
          overallExperience: 4.2,
        },
        overall: 4.2,
        weight: 2.0,
      },
    ],
  });

  // --- Verified Groups (one per audience) -----------------------------------
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

  // Sample posts in each audience-segmented group.
  const athleteLounge = await prisma.group.findUniqueOrThrow({ where: { slug: "athlete-lounge" } });
  const campusLife = await prisma.group.findUniqueOrThrow({ where: { slug: "campus-life" } });
  const parentNetwork = await prisma.group.findUniqueOrThrow({ where: { slug: "parent-network" } });

  if ((await prisma.groupPost.count({ where: { groupId: athleteLounge.id } })) === 0) {
    await prisma.groupPost.createMany({
      data: [
        {
          groupId: athleteLounge.id,
          authorId: athlete.id,
          title: "What's your training-table go-to?",
          body: "Curious what athletes lean on for pre-game meals. Our team has steak + sweet potato Tuesdays.",
          upvoteCount: 12,
          downvoteCount: 1,
          totalScore: 11,
        },
      ],
    });
  }
  if ((await prisma.groupPost.count({ where: { groupId: campusLife.id } })) === 0) {
    await prisma.groupPost.create({
      data: {
        groupId: campusLife.id,
        authorId: student.id,
        title: "Best dining hall on campus?",
        body: "Honest takes from current students — which dining hall actually slaps?",
        upvoteCount: 6,
        totalScore: 6,
      },
    });
  }
  if ((await prisma.groupPost.count({ where: { groupId: parentNetwork.id } })) === 0) {
    await prisma.groupPost.create({
      data: {
        groupId: parentNetwork.id,
        authorId: parent.id,
        title: "What to look for on an official visit",
        body: "Beyond the locker-room tour — questions to ask coaches, things to watch in practice.",
        upvoteCount: 8,
        totalScore: 8,
      },
    });
  }

  console.log("✅ Done seeding.");
  console.log("Test logins (password: password123):");
  console.log("  admin@coachscope.app   -> ADMIN");
  console.log("  athlete@coachscope.app -> VERIFIED_ATHLETE (paid + verified)");
  console.log("  student@coachscope.app -> VERIFIED_STUDENT (paid + verified)");
  console.log("  parent@coachscope.app  -> VERIFIED_PARENT  (paid + verified)");
  console.log("  pending@coachscope.app -> VERIFIED_STUDENT (paid, NOT yet verified — use this to test the gate)");
  console.log("  viewer@coachscope.app  -> VIEWER (free)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
