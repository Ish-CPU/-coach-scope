import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/universities/search?q=...
 *
 * Powers the university combobox on the connection forms (athlete + student)
 * and any other typeahead that needs to pick a `University` row by id.
 *
 * Behaviour:
 *   - With `q`: case-insensitive substring match against name OR city OR state.
 *     Returns up to 25 results, alphabetical by name.
 *   - Without `q`: returns the first 25 universities alphabetically as the
 *     "browse" set so the dropdown is never empty on first focus.
 *
 * The endpoint is intentionally public — University rows are not sensitive
 * and they're already enumerable via the search page. Rate limiting kicks in
 * at the global level via the existing rate-limit middleware.
 */
export const dynamic = "force-dynamic";

const MAX_RESULTS = 25;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  // Build the search filter. Empty `q` falls through to the browse query.
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { city: { contains: q, mode: "insensitive" as const } },
          { state: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const universities = await prisma.university.findMany({
    where,
    orderBy: { name: "asc" },
    take: MAX_RESULTS,
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
    },
  });

  return NextResponse.json({ universities });
}
