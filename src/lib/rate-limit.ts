import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Two-tier rate limiter.
 *
 *   PRODUCTION  → Upstash Redis sliding-window. Shared across every
 *                 serverless instance, so the limit is GLOBAL (the in-memory
 *                 fallback was per-instance and trivially bypassable on
 *                 Vercel's multi-instance scale).
 *   DEV/LOCAL   → in-memory Map fallback. Activates automatically when the
 *                 Upstash env vars aren't set, so `npm run dev` keeps
 *                 working without an internet connection or paid account.
 *
 * The fallback is intentionally identical to the old implementation so
 * local behavior doesn't drift from prod. It's just rate-limited per-process.
 *
 * Env vars (set both — they ship together from the Upstash console):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Both `rateLimit` and `rateLimitCheck` are NOW ASYNC. Every call site
 * has been updated to `await` them; new call sites must do the same.
 *
 * Usage from a route handler:
 *
 *   const limited = await rateLimit(req, "register", { max: 5, windowMs: 60_000 });
 *   if (limited) return limited;
 */

// ---------------------------------------------------------------------------
// Upstash client — built lazily so missing env vars don't crash the import.
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;
function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

/**
 * Memoize Ratelimit instances per (route, max, windowMs) combination —
 * Upstash recommends one instance per limit policy so it can hold the
 * server-side sliding-window state efficiently.
 */
const upstashLimiters = new Map<string, Ratelimit>();
function getUpstashLimiter(route: string, max: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${route}|${max}|${windowMs}`;
  const cached = upstashLimiters.get(key);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis,
    // Sliding window matches the old in-memory algorithm exactly: any
    // request in the past `windowMs` counts toward the cap.
    limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
    // Prefix keeps our keys grouped in the Redis namespace, makes the
    // Upstash dashboard usable for spot-checking abuse.
    prefix: `rl:${route}`,
    analytics: true,
  });
  upstashLimiters.set(key, limiter);
  return limiter;
}

// ---------------------------------------------------------------------------
// In-memory fallback (identical to the pre-Upstash implementation)
// ---------------------------------------------------------------------------

const buckets = new Map<string, number[]>();

function trim(arr: number[], windowStart: number): number[] {
  let i = 0;
  while (i < arr.length && arr[i] < windowStart) i++;
  return i === 0 ? arr : arr.slice(i);
}

function memoryCheck(
  identifier: string,
  route: string,
  max: number,
  windowMs: number
): { ok: boolean; retryAfter?: number } {
  const key = `${route}::${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  const trimmed = trim(buckets.get(key) ?? [], windowStart);
  if (trimmed.length >= max) {
    const retryAfterMs = (trimmed[0] ?? now) + windowMs - now;
    buckets.set(key, trimmed);
    return { ok: false, retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  trimmed.push(now);
  buckets.set(key, trimmed);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface Limit {
  max: number;
  windowMs: number;
}

export interface LimitOptions extends Limit {
  /** Override the auto-detected identifier (e.g. for session-based limits). */
  identifier?: string;
}

/** Pull the client IP from standard proxy headers; fall back to "unknown". */
export function clientIpFrom(req: Request | Headers): string {
  const headers = req instanceof Headers ? req : req.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

/**
 * Returns a 429 NextResponse if rate-limited, otherwise null.
 * Pass an `identifier` to limit per-user; otherwise we use the client IP.
 *
 * NOW ASYNC — must be awaited.
 */
export async function rateLimit(
  req: Request,
  route: string,
  opts: LimitOptions
): Promise<NextResponse | null> {
  const id = opts.identifier ?? clientIpFrom(req);
  const result = await rateLimitCheck(id, route, opts);
  if (result.ok) return null;

  const res = NextResponse.json(
    { error: "Too many requests. Please slow down and try again." },
    { status: 429 }
  );
  res.headers.set("Retry-After", String(result.retryAfter ?? 60));
  res.headers.set("X-RateLimit-Limit", String(opts.max));
  res.headers.set("X-RateLimit-Remaining", "0");
  return res;
}

/**
 * Pure version (no NextResponse) — for use inside NextAuth's authorize()
 * which doesn't return a Response. Returns the boolean "ok" plus the
 * Retry-After hint for callers that want to log it.
 *
 * NOW ASYNC — must be awaited.
 */
export async function rateLimitCheck(
  identifier: string,
  route: string,
  opts: Limit
): Promise<{ ok: boolean; retryAfter?: number }> {
  const upstash = getUpstashLimiter(route, opts.max, opts.windowMs);

  if (upstash) {
    // Production / staging path — global counter via Redis.
    const result = await upstash.limit(identifier);
    if (result.success) return { ok: true };
    const retryAfterMs = result.reset - Date.now();
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  // Local dev / no env vars — fall back to in-memory. Per-process only,
  // but good enough for `npm run dev`. Logging a warning once per cold
  // start helps surface accidentally-missing env vars in staging.
  warnOnceMissingUpstash();
  return memoryCheck(identifier, route, opts.max, opts.windowMs);
}

let warnedMissing = false;
function warnOnceMissingUpstash() {
  if (warnedMissing) return;
  warnedMissing = true;
  if (process.env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL / _TOKEN not set — using in-memory fallback. " +
        "This DOES NOT enforce global limits on Vercel. Set both env vars."
    );
  }
}
