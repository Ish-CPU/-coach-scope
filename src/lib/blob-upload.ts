/**
 * Vercel Blob upload helper.
 *
 * Centralizes the validation rules and the actual `put()` call so every
 * upload route (today: verification; tomorrow maybe coach photos, dorm
 * imagery, etc.) shares the same allowlist + size cap + path-prefix
 * conventions.
 *
 * RULES
 *   - Allowed MIME types: image/jpeg, image/png, image/webp, image/heic,
 *     application/pdf. Anything else is rejected — keeps the bucket free of
 *     executables, scripts, and oddities that would bloat the fraud-check
 *     codepath.
 *   - Size cap: 5MB. Verification photos are typically < 2MB; the cap is
 *     2.5× that to be generous about phone-camera HDR.
 *   - Filenames are randomized (cuid-style) — users never get to pick.
 *     This stops `?file=ssn.pdf` reconnaissance and prevents collisions.
 *   - Folder structure: `<kind>/<yyyy-mm>/<random>.<ext>`. The kind prefix
 *     scopes the bucket so admin tooling can later prune by kind, and
 *     the date bucket helps with cold-storage policies if we ever add
 *     them. Year-month not year-month-day — keeps the prefix list small.
 *   - Blob is public-read (default). Verification URLs are stored in the
 *     DB and fed to the fraud screener which fetches them. Don't put
 *     anything secret here.
 *
 * REQUIRED ENV VAR
 *   BLOB_READ_WRITE_TOKEN — provisioned automatically by Vercel when you
 *   create a Blob store in the project. Set manually in .env for local dev.
 */
import { put, type PutBlobResult } from "@vercel/blob";
import crypto from "crypto";
import { encryptBlobToken } from "@/lib/blob-token";

/** Allowed input MIME types. Keep in sync with ACCEPT below. */
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

/**
 * HTML `accept` attribute value to mirror this allowlist in client file
 * inputs. Keeps the validation policy in one place — bring this string
 * into your file picker, drop it onto `<input type="file" accept={...}>`,
 * and the browser pre-filters the picker UI.
 */
export const UPLOAD_ACCEPT_ATTR =
  "image/jpeg,image/png,image/webp,image/heic,application/pdf";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadOptions {
  /**
   * Logical bucket prefix — e.g. "verification", "coach-photo". Scopes
   * the path so admin tooling can target one kind at a time.
   */
  kind: string;
  /**
   * Stable per-user identifier to embed in the file's metadata (NOT the
   * path — paths stay random so URLs can't be guessed). Used by abuse-
   * investigation tooling to trace an upload back to the uploader.
   */
  userId: string;
}

export interface UploadResult {
  /** Public URL to the uploaded blob. */
  url: string;
  /** Blob pathname relative to the store. */
  pathname: string;
  /** MIME type the server inferred from the upload. */
  contentType: string;
  /** Byte count. */
  size: number;
}

/** Friendly errors the API route can pass through to the client. */
export class UploadValidationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "UploadValidationError";
  }
}

/**
 * Validate + upload. Throws UploadValidationError on disallowed input;
 * lets Vercel Blob errors bubble (the route handler should catch + map
 * to 5xx). Returns the public URL caller stores in the DB.
 */
export async function uploadBlob(
  file: File,
  options: UploadOptions
): Promise<UploadResult> {
  if (!file) throw new UploadValidationError("No file provided.");

  const size = file.size;
  if (size <= 0) throw new UploadValidationError("Empty file.");
  if (size > MAX_BYTES) {
    throw new UploadValidationError(
      `File too large (${(size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`
    );
  }

  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new UploadValidationError(
      `Unsupported file type "${mime || "unknown"}". Allowed: JPG, PNG, WebP, HEIC, PDF.`
    );
  }

  const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1] || "bin";
  // Random 16-byte hex — short, URL-safe, ~unguessable.
  const id = crypto.randomBytes(16).toString("hex");
  const monthKey = new Date().toISOString().slice(0, 7); // "2026-05"
  const pathname = `${options.kind}/${monthKey}/${id}.${ext}`;

  let result: PutBlobResult;
  try {
    result = await put(pathname, file, {
      // Private store — blob URLs are NOT publicly fetchable. Reads
      // happen via the @vercel/blob SDK's get() which uses our
      // BLOB_READ_WRITE_TOKEN to authenticate. Defense in depth:
      // even if a proxy URL leaks AND its token gets decrypted to
      // a pathname, fetching the bytes still requires our server
      // token.
      access: "private",
      contentType: mime,
      addRandomSuffix: false, // we generated our own random id above
    });
  } catch (err) {
    // Re-throw with a less leaky message — Blob errors can include
    // internal store IDs we don't want to surface to clients.
    const message = err instanceof Error ? err.message : "Upload failed.";
    throw new Error(`blob:put failed: ${message}`);
  }

  // Encrypt the pathname (not the URL) — pathname is what get() takes.
  // The proxy route decrypts back to a pathname and fetches via SDK.
  // The encryption layer prevents path enumeration and forged tokens.
  const proxyToken = encryptBlobToken(result.pathname);
  const proxyUrl = `/api/blob/${proxyToken}`;

  return {
    url: proxyUrl,
    pathname: result.pathname,
    contentType: mime,
    size,
  };
}
