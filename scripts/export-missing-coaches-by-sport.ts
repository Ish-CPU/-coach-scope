import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";

const prisma = new PrismaClient();

const sport = process.argv.slice(2).join(" ");

if (!sport) {
  console.error('Usage: npm run coaches:missing -- "Football"');
  process.exit(1);
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const schools = await prisma.school.findMany({
    where: { sport },
    include: {
      university: true,
      coaches: true,
    },
    orderBy: [
      { division: "asc" },
      { conference: "asc" },
    ],
  });

  const missing = schools.filter((s) => s.coaches.length === 0);

  mkdirSync("data/exports", { recursive: true });

  const rows = missing.map((s) =>
    `${s.university.name},${s.sport},${s.division},${s.conference ?? ""}`
  );

  const file = `data/exports/missing-${slugify(sport)}-coaches.csv`;
  writeFileSync(file, rows.join("\n"));

  console.log(`Sport: ${sport}`);
  console.log(`Programs: ${schools.length}`);
  console.log(`Missing coaches: ${missing.length}`);
  console.log(`Saved: ${file}`);

  await prisma.$disconnect();
}

main();
