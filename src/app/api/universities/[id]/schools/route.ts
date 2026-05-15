import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/universities/[id]/schools
 *
 * Returns the program (School) rows for a single university — used by the
 * shared <ProgramCombobox> in every connection / verification / upgrade
 * form. Returns sport, division, and conference so the dropdown row is
 * informative ("Football · D1 · Big 12") and not just "Football".
 *
 * 404s when the university id is unknown so the form can surface a clean
 * "No programs found" state instead of silently rendering an empty list
 * for what looks like a typo'd id.
 *
 * Server-side logging is intentionally on by default (console.info) — it's
 * how we debug the program-selector flow without a custom telemetry stack.
 * Comment the line out if log volume becomes an issue.
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
      `[api/universities/schools] universityId=${universityId} → 404 (university not found)`
    );
    return NextResponse.json({ error: "University not found." }, { status: 404 });
  }

  const schools = await prisma.school.findMany({
    where: { universityId },
    orderBy: [{ sport: "asc" }, { division: "asc" }],
    select: { id: true, sport: true, division: true, conference: true },
  });

  // eslint-disable-next-line no-console
  console.info(
    `[api/universities/schools] universityId=${universityId} (${university.name}) → ${schools.length} schools`
  );

  return NextResponse.json({ schools });
}
