import { NextResponse } from "next/server";

/**
 * Sliding-window in-memory rate limiter.
 *
 * Trade-offs:
 * - Single-process only. On Vercel, each serverless instance has its own
 *   counter, so this is *per-instance*, not global. That's enough to defeat
 *   trivial bots; for hardened protection (credential stuffing, distributed
 *   abuse) put a real shared store (Upstash, Redis) behind it.
 * - Buckets are keyed on `<route>:<identifier>` and contain timestamps of
 *   recent requests; trimmed on each call so memory stays bounded.
 * - Identifier prefers authenticated userId, falls back to client IP.
 *
 * Usage from a route handler:
 *
 *   const limited = await rateLimit(req, "register", { max: 5, windowMs: 60_000 });
 *   if (limited) return limited;
 */

const buckets = new Map<string, number[]>();

interface Limit {
  max: number;
  windowMs: number;
}

export interface LimitOptions extends Limit {
  /** Override the auto-detected identifier (e.g. for session-based limits). */
  identifier?: string;
}

function trim(arr: number[], windowStart: number): number[] {
  // Keep only timestamps inside the current window.
  let i = 0;
  while (i < arr.length && arr[i] < windowStart) i++;
  return i === 0 ? arr : arr.slice(i);
}

/** Pull the client IP from standard proxy headers; fall back to "unknown". */
export function clientIpFrom(req: Request | Headers): string {
  const headers = req instanceof Headers ? req : req.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // First IP in the comma-separated list is the original client.
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
 */
export function rateLimit(
  req: Request,
  route: string,
  opts: LimitOptions
): NextResponse | null {
  const id = opts.identifier ?? clientIpFrom(req);
  const key = `${route}::${id}`;
  const now = Date.now();
  const windowStart = now - opts.windowMs;

  const trimmed = trim(buckets.get(key) ?? [], windowStart);
  if (trimmed.length >= opts.max) {
    const retryAfterMs = (trimmed[0] ?? now) + opts.windowMs - now;
    const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
    buckets.set(key, trimmed);
    const res = NextResponse.json(
      { error: "Too many requests. Please slow down and try again." },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(retryAfter));
    res.headers.set("X-RateLimit-Limit", String(opts.max));
    res.headers.set("X-RateLimit-Remaining", "0");
    return res;
  }

  trimmed.push(now);
  buckets.set(key, trimmed);
  return null;
}

/**
 * Pure version (no NextResponse) — for use inside NextAuth's authorize()
 * which doesn't return a Response. Returns the boolean "ok" plus the
 * Retry-After hint for callers that want to log it.
 */
export function rateLimitCheck(
  identifier: string,
  route: string,
  opts: Limit
): { ok: boolean; retryAfter?: number } {
  const key = `${route}::${identifier}`;
  const now = Date.now();
  const windowStart = now - opts.windowMs;

  const trimmed = trim(buckets.get(key) ?? [], windowStart);
  if (trimmed.length >= opts.max) {
    const retryAfterMs = (trimmed[0] ?? now) + opts.windowMs - now;
    buckets.set(key, trimmed);
    return { ok: false, retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  trimmed.push(now);
  buckets.set(key, trimmed);
  return { ok: true };
}
