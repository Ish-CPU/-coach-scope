import fs from "fs";
import csv from "csv-parser";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const filePath = process.argv[2];

if (!filePath) {
    console.error("Usage: npx tsx scripts/import-coaches.ts path/to/coaches.csv");
    process.exit(1);
}

function clean(value?: string) {
    return value?.trim() || null;
}

async function main() {
    const rows: any[] = [];

    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath)
            .on("error", reject)
            .pipe(csv())
            .on("data", (row) => rows.push(row))
            .on("end", resolve)
            .on("error", reject);
    });

    console.log(`Rows loaded: ${rows.length}`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
        try {
            const universityName = clean(row.universityName);
            const name = clean(row.name);
            const slug = clean(row.slug);

            if (!universityName || !name || !slug) {
                skipped++;
                continue;
            }

            const university = await prisma.university.findFirst({
                where: {
                    name: universityName,
                },
            });

            if (!university) {
                console.log(`University not found: ${universityName}`);
                skipped++;
                continue;
            }

            const existing = await prisma.coach.findFirst({
                where: {
                    universityId: university.id,
                    OR: [{ slug }, { name }],
                },
            });

            const data = {
                name,
                slug,
                title: clean(row.title),
                sport: clean(row.sport),
                officialPageUrl: clean(row.officialPageUrl),
                sourceUrl: clean(row.sourceUrl),
                sourceName: clean(row.sourceName),
                lastVerifiedAt: new Date(),
                universityId: university.id,
            };

            if (existing) {
                await prisma.coach.update({
                    where: {
                        id: existing.id,
                    },
                    data,
                });

                updated++;
            } else {
                await prisma.coach.create({
                    data,
                });

                created++;
            }
        } catch (error) {
            console.error("Coach import error:", error);
            errors++;
        }
    }

    console.log("Coach import complete:");
    console.log({
        created,
        updated,
        skipped,
        errors,
    });
}

main()
    .catch((error) => {
        console.error("IMPORT FAILED");
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });