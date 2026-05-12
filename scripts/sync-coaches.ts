import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    include: {
      university: true,
      coaches: true,
    },
  });

  const missing = schools.filter((s) => s.coaches.length === 0);

  console.log(`Missing coaches: ${missing.length}`);

  for (const school of missing) {
    console.log(
      `${school.university.name} | ${school.sport} | ${school.division}`
    );
  }

  await prisma.$disconnect();
}

main();