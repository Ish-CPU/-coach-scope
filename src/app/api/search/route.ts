import { NextResponse } from "next/server";
import { runSearch, type SearchKind } from "@/lib/search";
import { Division, ReviewType } from "@prisma/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const hits = await runSearch({
    q: sp.get("q") ?? undefined,
    kind: (sp.get("kind") as SearchKind) ?? "all",
    sport: sp.get("sport") ?? undefined,
    division: (sp.get("division") as Division) ?? undefined,
    universityId: sp.get("universityId") ?? undefined,
    minRating: sp.get("minRating") ? Number(sp.get("minRating")) : undefined,
    reviewType: (sp.get("reviewType") as ReviewType) ?? undefined,
    verifiedAthleteOnly: sp.get("verifiedAthleteOnly") === "1",
    parentReviewsOnly: sp.get("parentReviewsOnly") === "1",
    verifiedStudentOnly: sp.get("verifiedStudentOnly") === "1",
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });

  return NextResponse.json({ results: hits });
}
