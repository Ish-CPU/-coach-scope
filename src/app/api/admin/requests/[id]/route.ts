import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status updates only — we never edit the submitter's text from this route.
// Approval here does NOT auto-create the school/program; that's a manual
// import via /admin/import. This is an explicit triage decision so admins
// can't accidentally promote junk into the public DB.
const patchSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "NEEDS_REVIEW"]),
  priorityScore: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.programRequest.update({
      where: { id: params.id },
      data: parsed.data,
      select: { id: true, status: true, priorityScore: true },
    });
    return NextResponse.json({ ok: true, request: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}
