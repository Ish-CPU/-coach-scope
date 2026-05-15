import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/schools/[id]/coaches
 *
 * Returns the Coach rows for a single school (program). Used by the
 * Write-a-Review form's coach picker after the user has chosen a
 * university and a program.
 *
 * No permission filtering here — this is purely about populating a
 * dropdown. The per-target permission gate runs at submit time inside
 * /api/reviews via `describeReviewBlock`. That keeps the picker UX
 * consistent with the rest of the app: search anything, then surface
 * the rejection reason if the user lacks the connection.
 *
 * 404s when the school id is unknown so the form can show a clean
 * "no coaches" empty state instead of silently returning [].
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const schoolId = params.id;
  if (!schoolId) {
    return NextResponse.json({ error: "Missing school id." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      sport: true,
      university: { select: { name: true } },
    },
  });
  if (!school) {
    // eslint-disable-next-line no-console
    console.info(
      `[api/schools/coaches] schoolId=${schoolId} → 404 (school not found)`
    );
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  const coaches = await prisma.coach.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, title: true, gender: true },
  });

  // eslint-disable-next-line no-console
  console.info(
    `[api/schools/coaches] schoolId=${schoolId} (${school.university.name} ${school.sport}) → ${coaches.length} coaches`
  );

  return NextResponse.json({ coaches });
}
