import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIpFrom } from "@/lib/rate-limit";
import { isAllowedSport } from "@/lib/sports";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { normalizeName } from "@/lib/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public submission endpoint — anonymous OK. Anti-abuse via in-memory rate
// limit keyed on client IP. Validation rejects oversized fields and obviously
// bogus URLs early so we never persist garbage.
const MAX_TEXT = 200;
const MAX_NOTES = 2000;

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || isSafeHttpUrl(v), {
    message: "Must be a valid http(s) URL",
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const requestSchema = z.object({
  schoolName: z.string().trim().min(2, "School name is required").max(MAX_TEXT),
  sport: z.string().trim().min(2, "Sport is required").max(MAX_TEXT),
  division: optionalText(40),
  conference: optionalText(MAX_TEXT),
  state: optionalText(40),
  level: optionalText(40),
  requesterRole: optionalText(40),
  requesterEmail: z
    .string()
    .trim()
    .max(MAX_TEXT)
    .email("Invalid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  rosterUrl: optionalUrl,
  athleticsUrl: optionalUrl,
  notes: optionalText(MAX_NOTES),
});

export async function POST(req: Request) {
  // 5 submissions per IP per 10 minutes. Generous for a real human; punishing
  // for a script. Identifier is IP because submissions are anonymous.
  const ip = clientIpFrom(req);
  const limited = rateLimit(req, "request:program", {
    max: 5,
    windowMs: 10 * 60_000,
    identifier: ip,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Soft sport gate: warn (don't reject) if it's outside our supported list,
  // because part of the point of this form is to surface gaps. Admins decide.
  const sportSupported = isAllowedSport(data.sport);

  // Dedupe: same normalized school + sport + division still PENDING/NEEDS_REVIEW.
  // We let APPROVED/REJECTED rows fall through so users can re-submit if their
  // earlier request was wrongly rejected.
  const normalizedName = normalizeName(data.schoolName);
  if (normalizedName) {
    const existing = await prisma.programRequest.findFirst({
      where: {
        sport: data.sport,
        division: data.division ?? null,
        status: { in: ["PENDING", "NEEDS_REVIEW"] },
      },
      select: { id: true, schoolName: true, status: true },
    });
    if (existing && normalizeName(existing.schoolName) === normalizedName) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          id: existing.id,
          message:
            "Thanks — a request for this school + sport is already in our queue.",
        },
        { status: 200 }
      );
    }
  }

  const created = await prisma.programRequest.create({
    data: {
      schoolName: data.schoolName,
      sport: data.sport,
      division: data.division ?? null,
      conference: data.conference ?? null,
      state: data.state ?? null,
      level: data.level ?? null,
      requesterRole: data.requesterRole ?? null,
      requesterEmail: data.requesterEmail ?? null,
      rosterUrl: data.rosterUrl ?? null,
      athleticsUrl: data.athleticsUrl ?? null,
      notes: data.notes ?? null,
      status: "PENDING",
    },
    select: { id: true },
  });

  return NextResponse.json(
    {
      ok: true,
      id: created.id,
      sportSupported,
      message: "Thanks — we'll add this to the import queue.",
    },
    { status: 201 }
  );
}
