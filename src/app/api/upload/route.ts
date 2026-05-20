/**
 * POST /api/upload
 *
 * Accepts a single file via multipart/form-data, validates it, uploads
 * to Vercel Blob, and returns the public URL. Client-side flows (the
 * verification + connection forms) call this to convert a user-picked
 * file into a URL string they can then submit to /api/verification etc.
 *
 * INPUT (multipart/form-data):
 *   file: File              — the actual binary
 *   kind: "verification"    — bucket prefix; whitelist-checked below
 *
 * OUTPUT (JSON):
 *   { url, pathname, contentType, size }
 *
 * Errors:
 *   401 — unauthenticated
 *   403 — VIEWER role (must pick a role before uploading verification docs)
 *   413 — file too large / unsupported type (UploadValidationError)
 *   429 — rate limited
 *   500 — Blob store error
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { uploadBlob, UploadValidationError } from "@/lib/blob-upload";
import { UserRole } from "@prisma/client";

const ALLOWED_KINDS = new Set(["verification", "connection"]);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  }
  if (session.user.role === UserRole.VIEWER) {
    return NextResponse.json(
      { error: "Pick a role before uploading." },
      { status: 403 }
    );
  }

  // Per-user rate limit — uploads are expensive (Blob storage + later
  // fraud screen). 10 uploads / 10 minutes is generous for legitimate
  // verification flows (typically 1-3 uploads per attempt) and stops
  // anyone trying to scrape free image hosting from the bucket.
  const limited = await rateLimit(req, "upload", {
    max: 10,
    windowMs: 10 * 60_000,
    identifier: session.user.id,
  });
  if (limited) return limited;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart body." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file field." },
      { status: 400 }
    );
  }

  const kind = String(formData.get("kind") ?? "");
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json(
      { error: `Unsupported upload kind: ${kind || "(blank)"}` },
      { status: 400 }
    );
  }

  try {
    const result = await uploadBlob(file, { kind, userId: session.user.id });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // eslint-disable-next-line no-console
    console.error("[upload] failed", err);
    return NextResponse.json(
      { error: "Upload failed. Try again." },
      { status: 500 }
    );
  }
}
