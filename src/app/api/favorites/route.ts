import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { describeGate, getSession, whyCannotParticipate } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";

const schema = z
  .object({
    coachId: z.string().cuid().optional(),
    schoolId: z.string().cuid().optional(),
    universityId: z.string().cuid().optional(),
    dormId: z.string().cuid().optional(),
  })
  .refine(
    (d) => Boolean(d.coachId || d.schoolId || d.universityId || d.dormId),
    "Provide one of coachId/schoolId/universityId/dormId"
  );

export async function POST(req: Request) {
  const session = await getSession();
  const gate = whyCannotParticipate(session);
  if (gate) {
    return NextResponse.json({ error: describeGate(gate) }, { status: 403 });
  }

  const limited = rateLimit(req, "favorite:toggle", {
    max: 60,
    windowMs: 60_000,
    identifier: session!.user.id,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = session!.user.id;
  const { coachId, schoolId, universityId, dormId } = parsed.data;

  const existing = await prisma.favorite.findFirst({
    where: { userId, coachId: coachId ?? null, schoolId: schoolId ?? null, universityId: universityId ?? null, dormId: dormId ?? null },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }

  await prisma.favorite.create({
    data: { userId, coachId, schoolId, universityId, dormId },
  });
  return NextResponse.json({ favorited: true });
}
