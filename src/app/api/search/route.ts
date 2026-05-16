import { NextResponse } from "next/server";
import { runSearch, type SearchKind } from "@/lib/search";
import { normalizeSport } from "@/lib/sports";
import { parseMinRating } from "@/lib/rating-filter";
import { parseDivision } from "@/lib/division";
import { rateLimit } from "@/lib/rate-limit";
import { ReviewType } from "@prisma/client";

export async function GET(req: Request) {
  // Anonymous, scrapable endpoint — rate-limit by IP. The cap is generous
  // enough for a real user clicking through search results but cheap enough
  // that a script can't enumerate the whole graph in a minute.
  const limited = rateLimit(req, "search", { max: 60, windowMs: 60_000 });
  if (limited) return limited;

  const url = new URL(req.url);
  const sp = url.searchParams;

  const hits = await runSearch({
    q: sp.get("q") ?? undefined,
    kind: (sp.get("kind") as SearchKind) ?? "all",
    sport: normalizeSport(sp.get("sport")) ?? undefined,
    // Off-list `?division=` values are silently dropped instead of poisoning
    // the WHERE clause or matching the empty string.
    division: parseDivision(sp.get("division")) ?? undefined,
    universityId: sp.get("universityId") ?? undefined,
    minRating: parseMinRating(sp.get("minRating")) ?? undefined,
    reviewType: (sp.get("reviewType") as ReviewType) ?? undefined,
    verifiedAthleteOnly: sp.get("verifiedAthleteOnly") === "1",
    parentReviewsOnly: sp.get("parentReviewsOnly") === "1",
    verifiedStudentOnly: sp.get("verifiedStudentOnly") === "1",
    // Lifecycle filters. `currentOnly` and `alumniOnly` are mutually
    // exclusive — combining both returns the empty intersection.
    currentOnly: sp.get("currentOnly") === "1",
    alumniOnly: sp.get("alumniOnly") === "1",
    formerUniversityId: sp.get("formerUniversityId") ?? undefined,
    formerProgramId: sp.get("formerProgramId") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });

  return NextResponse.json({ results: hits });
}
