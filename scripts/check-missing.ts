import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const schools = await p.school.findMany({
    include: { coaches: true },
  });

  const missing = schools.filter(s => s.coaches.length === 0);

  console.log("Missing coaches:", missing.length);
}

main().finally(() => p.$disconnect());