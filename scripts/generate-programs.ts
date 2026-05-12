import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFERENCE_SPORTS: Record<string, string[]> = {
  "Big Ten": [
    "Football",
    "Men's Basketball",
    "Women's Basketball",
    "Baseball",
    "Softball",
    "Men's Soccer",
    "Women's Soccer",
  ],
  "SEC": [
    "Football",
    "Men's Basketball",
    "Women's Basketball",
    "Baseball",
    "Softball",
    "Women's Soccer",
  ],
  "ACC": [
    "Football",
    "Men's Basketball",
    "Women's Basketball",
    "Baseball",
    "Softball",
    "Men's Soccer",
    "Women's Soccer",
  ],
  "American Athletic Conference": [
    "Football",
    "Men's Basketball",
    "Women's Basketball",
    "Baseball",
    "Softball",
    "Men's Soccer",
    "Women's Soccer",
  ],
  "Big 12": [
    "Football",
    "Men's Basketball",
    "Women's Basketball",
    "Baseball",
    "Softball",
    "Women's Soccer",
  ],
  "Mid-American Conference": [
    "Football",
    "Men's Basketball",
    "Women's Basketball",
    "Baseball",
    "Softball",
    "Women's Soccer",
  ],
};

async function main() {
  const schools = await prisma.school.findMany({
    include: { university: true },
  });

  const universities = await prisma.university.findMany();

  let created = 0;

  for (const u of universities) {
    const existing = schools.find(s => s.universityId === u.id);
    if (!existing) continue;

    const conference = existing.conference;
    const division = existing.division;

    const sports = CONFERENCE_SPORTS[conference ?? ""];
    if (!sports) continue;

    for (const sport of sports) {
      const exists = schools.find(
        s =>
          s.universityId === u.id &&
          s.sport === sport
      );

      if (exists) continue;

      await prisma.school.create({
        data: {
          universityId: u.id,
          sport,
          division,
          conference,
          seasonYear: "2025-2026",
        },
      });

      console.log(`+ ${u.name} ${sport}`);
      created++;
    }
  }

  console.log("Created programs:", created);
  await prisma.$disconnect();
}

main();