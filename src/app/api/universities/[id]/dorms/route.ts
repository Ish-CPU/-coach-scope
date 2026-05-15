import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/universities/[id]/dorms
 *
 * Returns the Dorm rows for a single university. Used by the
 * Write-a-Review form's dorm picker after the user has chosen a
 * university for a DORM review.
 *
 * Same contract as /api/universities/[id]/schools and
 * /api/schools/[id]/coaches — populates a dropdown only; permission
 * gating happens at submit time in /api/reviews.
 *
 * 404s when the university id is unknown.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const universityId = params.id;
  if (!universityId) {
    return NextResponse.json({ error: "Missing university id." }, { status: 400 });
  }

  const university = await prisma.university.findUnique({
    where: { id: universityId },
    select: { id: true, name: true },
  });
  if (!university) {
    // eslint-disable-next-line no-console
    console.info(
      `[api/universities/dorms] universityId=${universityId} → 404 (university not found)`
    );
    return NextResponse.json({ error: "University not found." }, { status: 404 });
  }

  const dorms = await prisma.dorm.findMany({
    where: { universityId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, roomType: true, bathroomType: true },
  });

  // eslint-disable-next-line no-console
  console.info(
    `[api/universities/dorms] universityId=${universityId} (${university.name}) → ${dorms.length} dorms`
  );

  return NextResponse.json({ dorms });
}
