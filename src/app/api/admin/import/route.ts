import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { canImportData } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
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
  if (!canImportData(session)) {
    return NextResponse.json(
      { error: "You don't have permission to run imports." },
      { status: 403 }
    );
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
  // MIME-type whitelist. Browsers report inconsistent MIME for CSVs (some
  // send application/vnd.ms-excel, some text/plain), so we accept the common
  // set and the file-extension fallback. The importer itself validates the
  // header row before any DB write so this is just an early "looks reasonable"
  // gate to keep obvious garbage out of memory.
  if (file instanceof File) {
    const okType = new Set([
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "text/plain",
      "",
    ]);
    const looksCsv =
      okType.has(file.type) || file.name.toLowerCase().endsWith(".csv");
    if (!looksCsv) {
      return NextResponse.json(
        { error: "Expected a .csv file." },
        { status: 415 }
      );
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await importCsv(prisma, type as ImportType, buffer);
    await logAdminAction({
      actorUserId: session!.user.id,
      action: AUDIT_ACTIONS.IMPORT_RUN,
      targetType: "Import",
      metadata: {
        type,
        bytes: file.size,
        // `result` shape comes from importCsv; capture whatever counts it returns.
        result: result as any,
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400 }
    );
  }
}
