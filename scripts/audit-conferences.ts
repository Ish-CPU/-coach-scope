import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const schools = await p.school.findMany({
    include: {
      coaches: true,
    },
  });

  const map: Record<string, { programs: number; coaches: number }> = {};

  for (const s of schools) {
    const key = [
      s.division,
      s.conference ?? "NO_CONFERENCE",
      s.sport,
    ].join(" | ");

    if (!map[key]) {
      map[key] = {
        programs: 0,
        coaches: 0,
      };
    }

    map[key].programs += 1;

    if (s.coaches.length > 0) {
      map[key].coaches += 1;
    }
  }

  console.log(
    "DIVISION | CONFERENCE | SPORT | PROGRAM COUNT | COACH COUNT"
  );
  console.log(
    "--------------------------------------------------------------------------"
  );

  for (const key of Object.keys(map).sort()) {
    const row = map[key];

    console.log(
      `${key} | ${row.programs} | ${row.coaches}`
    );
  }

  await p.$disconnect();
}

main();
