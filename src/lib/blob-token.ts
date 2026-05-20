/**
 * Encrypted token codec for blob proxy URLs.
 *
 * The privacy model:
 *
 *   1. Upload writes the bytes to Vercel Blob with `access: "public"`
 *      (the only access mode the package currently supports).
 *   2. The real Vercel Blob URL (which IS publicly fetchable) never
 *      leaves the server. It's wrapped in a signed/encrypted token
 *      before being returned to the client.
 *   3. The client form stores the proxy URL `/api/blob/<token>` and
 *      submits it as the value of `studentIdUrl`, `proofUrl`, etc.
 *   4. When something needs the bytes (admin UI showing the image,
 *      fraud screener fetching it), the server decrypts the token,
 *      recovers the real URL, and fetches.
 *
 * Why AES-GCM (vs. just HMAC-signing the URL):
 *   - The token must NOT reveal the underlying URL to anyone holding
 *     it. With HMAC-signing, the URL is base64-readable; an attacker
 *     who pastes the proxy URL into a decoder can extract the real
 *     Blob URL and fetch it directly (bypassing our auth check).
 *   - AES-GCM (authenticated encryption) keeps the URL fully opaque
 *     AND verifies integrity. A tampered token won't decrypt.
 *
 * Key derivation:
 *   - Uses NEXTAUTH_SECRET (already in env for session signing).
 *   - sha256(secret) gives us a deterministic 32-byte key without
 *     needing a new env var or keypair management.
 */
import crypto from "crypto";

const ALG = "aes-256-gcm";
const IV_LENGTH = 12;            // GCM standard
const KEY_LENGTH = 32;           // AES-256
const AUTH_TAG_LENGTH = 16;      // GCM standard

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "[blob-token] NEXTAUTH_SECRET not set — cannot derive encryption key."
    );
  }
  cachedKey = crypto.createHash("sha256").update(secret).digest();
  if (cachedKey.length !== KEY_LENGTH) {
    throw new Error("[blob-token] derived key wrong length");
  }
  return cachedKey;
}

/** url-safe base64 — drop padding, swap +/= for -_ */
function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

/**
 * Encrypt a string (the real Vercel Blob URL). Returns a url-safe token
 * suitable for embedding in a path segment.
 *
 * Format: <iv>.<authTag>.<ciphertext>, each base64url-encoded.
 */
export function encryptBlobToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALG, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${b64url(iv)}.${b64url(tag)}.${b64url(ct)}`;
}

/**
 * Decrypt a token back to the original URL. Returns null on any failure
 * (malformed input, wrong key, tampered ciphertext). Never throws —
 * routes can safely 404 on null without leaking the failure reason.
 */
export function decryptBlobToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const iv = b64urlDecode(parts[0]);
    const tag = b64urlDecode(parts[1]);
    const ct = b64urlDecode(parts[2]);
    if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) return null;
    const decipher = crypto.createDecipheriv(ALG, getKey(), iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Returns true if the given URL is one of our /api/blob/<token> proxy
 * URLs. Used by the fraud screening service + any other server-side
 * code that needs to detect-and-resolve.
 */
export function isProxyBlobUrl(url: string): boolean {
  return url.startsWith("/api/blob/") || url.includes("/api/blob/");
}

/**
 * Validate a string that should be either:
 *   - a full https:// URL (legacy paste-a-URL flow OR external roster URL), OR
 *   - one of our /api/blob/<token> proxy URLs (new file-upload flow)
 *
 * Returns the input unchanged on success, throws on rejection — designed
 * to be wrapped by `z.string().refine(...)` or used as a manual check.
 * The default Zod `.url()` validator rejects relative URLs, so this
 * helper is what every URL-bearing form field NOW needs.
 */
export function isAcceptableUploadOrUrl(value: string): boolean {
  if (!value) return false;
  if (isProxyBlobUrl(value)) return true;
  // Loose URL check — Zod's full URL parser would also accept
  // ftp:// etc., but for our use case https/http is fine. We don't
  // need to be stricter than the prior validator was.
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Pull the token out of a proxy URL string (relative or absolute) and
 * decrypt it. Returns the real URL on success, null on any malformed
 * input or signature/decryption failure.
 */
export function resolveProxyBlobUrl(maybeProxyUrl: string): string | null {
  if (!isProxyBlobUrl(maybeProxyUrl)) return null;
  // Path looks like ".../api/blob/<token>" — split off everything before
  // /api/blob/ and read the rest as the token (no slashes inside tokens
  // since they're base64url + dots).
  const idx = maybeProxyUrl.indexOf("/api/blob/");
  if (idx < 0) return null;
  const tail = maybeProxyUrl.slice(idx + "/api/blob/".length);
  // Strip any query string / fragment.
  const token = tail.split(/[?#]/)[0];
  if (!token) return null;
  return decryptBlobToken(token);
}
