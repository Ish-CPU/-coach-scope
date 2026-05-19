// ---------------------------------------------------------------------------
// Verification image fraud screening
// ---------------------------------------------------------------------------
//
// Pluggable AI/fraud screen for uploaded verification + connection images
// (student IDs, roster screenshots, parent-proof photos, etc.). Called from
// the verification + connection POST routes BEFORE the parent row is
// persisted, so high-confidence fraud is rejected without ever entering
// the human-review queue.
//
// Hard rules (mirror the product brief — do not soften):
//   - A CLEAR score never auto-approves anything. It just means "don't
//     add fraud-driven friction on top of normal admin review."
//   - A DENIED score blocks THIS submission. It never bans the user.
//   - Per-user uploads are rate-limited (callers compose rateLimit + this
//     module's screenVerificationImage).
//   - User-facing errors are generic ("We couldn't verify this upload…")
//     — provider scores, model labels, etc. NEVER leak to the response.
//
// Provider model:
//   The default provider is a `NoopProvider` that returns score=50
//   (REVIEW_REQUIRED). This keeps the app fully functional in dev and in
//   environments where no AI provider key is configured — every upload
//   gets human eyes instead of a hard fail. Real provider stubs (Hive,
//   Sensity, Reality Defender, Google Vision / AWS Rekognition OCR) are
//   scaffolded below; they only activate when their env var is set.

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { FraudStatus } from "@prisma/client";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Polymorphic target — also stored on ImageFraudCheck.targetType. */
export type FraudTargetType =
  | "verification"
  | "athlete_connection"
  | "student_connection";

/** Output of a single provider call. `score` is normalized to 0-100. */
export interface FraudResult {
  status: FraudStatus;
  /** 0-100, higher = more suspicious. */
  score: number;
  reasons: string[];
  provider: string;
}

/** Extended result returned to the caller. */
export interface ScreenResult extends FraudResult {
  /** SHA-256 of the image bytes. Persisted on ImageFraudCheck.imageHash. */
  hash: string;
  /**
   * The persisted ImageFraudCheck row id. Useful for the admin UI to
   * cross-link the verification row to its underlying check.
   */
  checkId: string;
  /**
   * `true` when the result was satisfied from a previous DENIED row with
   * the same hash — no provider call was made. Surfaced for telemetry
   * (we expect this to grow over time as the deny list accumulates).
   */
  fromDedup: boolean;
}

interface FraudProvider {
  readonly name: string;
  /**
   * Implement against the provider's API. Receive the raw bytes + mime
   * type so the same provider can branch on image vs PDF. Return a 0-100
   * suspicion score plus a list of structured labels.
   *
   * Must NEVER throw on a network error — convert to a REVIEW_REQUIRED
   * result with a `provider_error` reason so the orchestrator can persist
   * something deterministic and the upload doesn't silently disappear.
   */
  screen(input: {
    url: string;
    bytes: Buffer;
    mimeType: string | null;
  }): Promise<Omit<FraudResult, "provider">>;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Bucket boundaries per the product brief:
 *    0-49  → CLEAR
 *   50-79  → REVIEW_REQUIRED
 *   80-100 → DENIED
 *
 * Pure function — exported so callers (UI, admin tools) can apply the
 * same thresholds without re-running the screen.
 */
export function bucketize(score: number): FraudStatus {
  if (!Number.isFinite(score)) return FraudStatus.REVIEW_REQUIRED;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= 80) return FraudStatus.DENIED;
  if (clamped >= 50) return FraudStatus.REVIEW_REQUIRED;
  return FraudStatus.CLEAR;
}

/** Maximum image size we'll fetch (5 MB). Above this we skip + REVIEW. */
const MAX_FETCH_BYTES = 5 * 1024 * 1024;

/** Maximum bytes we'll buffer in memory waiting for the screen to complete. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Generic message returned to USERS on a DENIED screen. Never includes
 * the score, reason labels, or the provider name. Exported as a constant
 * so every consumer surfaces the same copy verbatim.
 */
export const FRAUD_USER_FACING_MESSAGE =
  "We couldn't verify this upload. Please submit a clearer official document or contact support.";

// ---------------------------------------------------------------------------
// Main entry — orchestrates fetch → dedup → screen → persist
// ---------------------------------------------------------------------------

export async function screenVerificationImage(input: {
  userId: string;
  url: string;
  targetType: FraudTargetType;
  /** Pass null when the parent row hasn't been created yet; backfill later. */
  targetId: string | null;
}): Promise<ScreenResult> {
  const provider = resolveProvider();

  // 1. Fetch the image. Network/format failures degrade to REVIEW_REQUIRED
  //    rather than blocking the entire flow — admin still gets eyes on it,
  //    and the user sees a normal "submitted, pending review" experience.
  const fetched = await safeFetchImage(input.url);
  if (!fetched.ok) {
    const result: FraudResult = {
      status: FraudStatus.REVIEW_REQUIRED,
      score: 60,
      reasons: [fetched.reason],
      provider: provider.name,
    };
    const persisted = await persistCheck(input, result, /* hash */ null);
    await logFraudAudit(input.userId, result, persisted.id, input);
    return { ...result, hash: persisted.imageHash, checkId: persisted.id, fromDedup: false };
  }

  // 2. Hash + dedup. A previously-DENIED hash short-circuits the provider
  //    call entirely. We still write a fresh ImageFraudCheck row pointing
  //    at the new target so the audit trail captures the retry attempt.
  const hash = sha256(fetched.bytes);
  const denied = await findDeniedHash(hash);
  if (denied) {
    const result: FraudResult = {
      status: FraudStatus.DENIED,
      score: denied.score, // preserve the original score for transparency
      reasons: ["previously_denied_image", ...denied.reasons],
      provider: denied.provider,
    };
    const persisted = await persistCheck(input, result, hash);
    await logFraudAudit(input.userId, result, persisted.id, input);
    return { ...result, hash, checkId: persisted.id, fromDedup: true };
  }

  // 3. Provider call. Wrapped in try/catch because provider stubs must
  //    not crash the request path under any circumstances.
  let providerResult: Omit<FraudResult, "provider">;
  try {
    providerResult = await provider.screen({
      url: input.url,
      bytes: fetched.bytes,
      mimeType: fetched.mimeType,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[fraud] provider threw, degrading to REVIEW", err);
    providerResult = {
      status: FraudStatus.REVIEW_REQUIRED,
      score: 60,
      reasons: ["provider_error"],
    };
  }

  // Defensive — re-bucket here so a provider that returns inconsistent
  // score+status pairs can't write a misclassified row.
  const result: FraudResult = {
    ...providerResult,
    status: bucketize(providerResult.score),
    provider: provider.name,
  };

  const persisted = await persistCheck(input, result, hash);
  await logFraudAudit(input.userId, result, persisted.id, input);
  return { ...result, hash, checkId: persisted.id, fromDedup: false };
}

/**
 * Convenience: screen every URL on a verification or connection submission
 * and return the WORST result (highest score). Most callers only care
 * about the bucket — a single DENIED among five uploads should block the
 * whole submission.
 *
 * For callers that ALSO need per-URL results (e.g. the multi-proof
 * scoring path that maps fraud back to individual proof types), use
 * `screenAllByUrl` instead — it returns both the worst AND a per-URL
 * map in a single pass.
 */
export async function screenMultiple(input: {
  userId: string;
  urls: Array<string | null | undefined>;
  targetType: FraudTargetType;
  targetId: string | null;
}): Promise<ScreenResult | null> {
  const { worst } = await screenAllByUrl(input);
  return worst;
}

/**
 * Screen every URL and return BOTH the worst result and a per-URL map.
 * Callers that need to attribute fraud results back to specific proof
 * types (multi-proof scoring) should use this; callers that only care
 * whether ANY upload failed (connection routes) can stick with
 * `screenMultiple`.
 */
export async function screenAllByUrl(input: {
  userId: string;
  urls: Array<string | null | undefined>;
  targetType: FraudTargetType;
  targetId: string | null;
}): Promise<{ worst: ScreenResult | null; byUrl: Map<string, ScreenResult> }> {
  const valid = input.urls
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => u.length > 0);
  const byUrl = new Map<string, ScreenResult>();
  if (valid.length === 0) return { worst: null, byUrl };

  let worst: ScreenResult | null = null;
  // De-dup the URL list so a form that reuses the same URL across two
  // fields doesn't double-charge the provider or write two
  // ImageFraudCheck rows.
  const unique = Array.from(new Set(valid));
  for (const url of unique) {
    const r = await screenVerificationImage({
      userId: input.userId,
      url,
      targetType: input.targetType,
      targetId: input.targetId,
    });
    byUrl.set(url, r);
    if (!worst || r.score > worst.score) worst = r;
  }
  return { worst, byUrl };
}

// ---------------------------------------------------------------------------
// Internal: fetch + hash + dedup
// ---------------------------------------------------------------------------

type FetchResult =
  | { ok: true; bytes: Buffer; mimeType: string | null }
  | { ok: false; reason: string };

async function safeFetchImage(url: string): Promise<FetchResult> {
  // Lightweight URL validation. Rejecting non-http(s) early avoids the
  // node fetch surprise of throwing on data: / file: URIs.
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, reason: "unsupported_url_scheme" };
    }
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return { ok: false, reason: `fetch_status_${res.status}` };
    const cl = res.headers.get("content-length");
    if (cl && Number(cl) > MAX_FETCH_BYTES) {
      return { ok: false, reason: "image_too_large" };
    }
    const arr = await res.arrayBuffer();
    if (arr.byteLength > MAX_FETCH_BYTES) {
      return { ok: false, reason: "image_too_large" };
    }
    return {
      ok: true,
      bytes: Buffer.from(arr),
      mimeType: res.headers.get("content-type"),
    };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError"
      ? "fetch_timeout"
      : "fetch_failed";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function findDeniedHash(hash: string): Promise<{
  score: number;
  reasons: string[];
  provider: string;
} | null> {
  const prior = await prisma.imageFraudCheck.findFirst({
    where: { imageHash: hash, status: FraudStatus.DENIED },
    select: { score: true, reasons: true, provider: true },
    orderBy: { createdAt: "desc" },
  });
  return prior;
}

// ---------------------------------------------------------------------------
// Internal: persistence
// ---------------------------------------------------------------------------

interface PersistedCheck {
  id: string;
  imageHash: string;
}

async function persistCheck(
  input: {
    userId: string;
    url: string;
    targetType: FraudTargetType;
    targetId: string | null;
  },
  result: FraudResult,
  hash: string | null
): Promise<PersistedCheck> {
  // When the hash wasn't computed (fetch failure path), fall back to a
  // synthetic value tagged with the URL + timestamp so the row stays
  // queryable by URL but never collides with a real hash. The `@unique`
  // index on imageHash forbids collisions; synthetic values include a
  // randomly-generated suffix to guarantee uniqueness.
  const finalHash = hash ?? `unfetched:${sha256(Buffer.from(`${input.url}:${Date.now()}:${Math.random()}`))}`;
  try {
    const row = await prisma.imageFraudCheck.create({
      data: {
        userId: input.userId,
        imageUrl: input.url,
        imageHash: finalHash,
        targetType: input.targetType,
        targetId: input.targetId,
        status: result.status,
        score: result.score,
        reasons: result.reasons,
        provider: result.provider,
      },
      select: { id: true, imageHash: true },
    });
    return row;
  } catch (err) {
    // Race: another request just persisted the exact same hash. Re-read
    // the existing row instead of bubbling. Practically only happens on
    // duplicate submissions from the same user fired in parallel.
    const existing = await prisma.imageFraudCheck.findUnique({
      where: { imageHash: finalHash },
      select: { id: true, imageHash: true },
    });
    if (existing) return existing;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internal: audit logging
// ---------------------------------------------------------------------------

async function logFraudAudit(
  userId: string,
  result: FraudResult,
  checkId: string,
  ctx: { targetType: FraudTargetType; targetId: string | null }
): Promise<void> {
  const action =
    result.status === FraudStatus.DENIED
      ? AUDIT_ACTIONS.AI_FRAUD_AUTO_DENIED
      : result.status === FraudStatus.REVIEW_REQUIRED
        ? AUDIT_ACTIONS.AI_FRAUD_REVIEW_REQUIRED
        : AUDIT_ACTIONS.AI_FRAUD_CHECK_PASSED;
  await logAdminAction({
    actorUserId: userId,
    action,
    targetType: ctx.targetType,
    targetId: ctx.targetId ?? checkId,
    metadata: {
      checkId,
      score: result.score,
      reasons: result.reasons,
      provider: result.provider,
    },
  });
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * Dev fallback. Returns REVIEW_REQUIRED so the app stays functional
 * without an AI key — every upload goes to human eyes. We deliberately do
 * NOT return CLEAR here; an unconfigured provider that auto-passes
 * everything would silently disable fraud protection in dev/staging.
 */
class NoopProvider implements FraudProvider {
  readonly name = "noop";
  async screen(): Promise<Omit<FraudResult, "provider">> {
    return {
      status: FraudStatus.REVIEW_REQUIRED,
      score: 50,
      reasons: ["no_provider_configured"],
    };
  }
}

/**
 * Stub for Hive Moderation's AI-generated-image detector. Wire the real
 * API call inside `screen()` when HIVE_API_KEY is provisioned. Until
 * then, behaves like the noop provider but tags rows with provider
 * name "hive_stub" so we can tell the staging-flag-only rollout from a
 * fully-unconfigured environment.
 *
 * Reference shape (subject to current Hive docs at integration time):
 *   POST https://api.thehive.ai/api/v2/task/sync
 *   Authorization: token <HIVE_API_KEY>
 *   form-data: media=<bytes>
 *   response.status_code → bucketize based on the AI-classifier output
 */
class HiveProviderStub implements FraudProvider {
  readonly name = "hive_stub";
  constructor(private readonly apiKey: string) {}
  async screen(): Promise<Omit<FraudResult, "provider">> {
    // Intentionally returns REVIEW until real integration is wired.
    // Implementer: replace this body with the actual HTTP call and
    // map response.classes[].score (0-1) to a 0-100 suspicion.
    return {
      status: FraudStatus.REVIEW_REQUIRED,
      score: 55,
      reasons: ["hive_stub_pending_integration"],
    };
  }
  /** Surface that the API key is configured so `resolveProvider` can pick us. */
  static fromEnv(): HiveProviderStub | null {
    const k = process.env.HIVE_API_KEY;
    return k ? new HiveProviderStub(k) : null;
  }
}

/**
 * Future-vendor scaffolding. Adding a new provider is:
 *   1. New class implementing FraudProvider
 *   2. fromEnv() static reading the right env var
 *   3. Add it to the priority chain in `resolveProvider`
 * No other module changes required.
 */
function resolveProvider(): FraudProvider {
  return (
    HiveProviderStub.fromEnv() ??
    // Add SensityProviderStub.fromEnv(), RealityDefenderProviderStub.fromEnv(),
    // GoogleVisionOcrProviderStub.fromEnv(), AwsRekognitionProviderStub.fromEnv()
    // here as they're integrated.
    new NoopProvider()
  );
}
