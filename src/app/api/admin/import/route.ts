import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { importCsv, IMPORT_TYPES, type ImportType } from "@/lib/import-csv";

export const runtime = "nodejs";
// Multipart uploads can be a few hundred KB easily.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED = new Set<string>(IMPORT_TYPES.map((t) => t.value));

export async function POST(req: Request) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const type = form.get("type");
  const file = form.get("file");
  if (typeof type !== "string" || !ALLOWED.has(type)) {
    return NextResponse.json(
      { error: `Unknown import type. Allowed: ${[...ALLOWED].join(", ")}` },
      { status: 400 }
    );
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing 'file' upload field." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "CSV is too large (5 MB max)." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await importCsv(prisma, type as ImportType, buffer);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400 }
    );
  }
}
