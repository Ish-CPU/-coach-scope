/**
 * In-memory tracker for failed admin sign-in attempts.
 *
 * Triggers a single security alert email per email-address per cooldown
 * window when the failure count crosses `THRESHOLD`. A successful sign-in
 * (or just letting the window pass) resets the counter so the alert fires
 * again on a fresh attack.
 *
 * In-memory is intentional — fits the existing app architecture (no Redis
 * yet) and the rate-limit module already uses the same pattern. If we add
 * a shared cache later this is the one place to swap implementations.
 */

const THRESHOLD = 10;
const WINDOW_MS = 15 * 60_000; // 15 minutes
const ALERT_COOLDOWN_MS = 60 * 60_000; // suppress duplicate alerts for an hour

interface Bucket {
  /** Failure timestamps within the rolling window. */
  failures: number[];
  /** When we last fired an alert for this email — used to suppress spam. */
  lastAlertAt?: number;
}

const buckets = new Map<string, Bucket>();

function trim(times: number[], windowStart: number): number[] {
  let i = 0;
  while (i < times.length && times[i] < windowStart) i++;
  return i === 0 ? times : times.slice(i);
}

/**
 * Record a failed admin sign-in. Returns the structured outcome so the
 * caller (typically `authorize()` in src/lib/auth.ts) can decide whether
 * to fire the security alert email.
 */
export function recordFailedAdminLogin(email: string): {
  count: number;
  thresholdExceeded: boolean;
} {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const existing = buckets.get(key) ?? { failures: [] };
  existing.failures = trim(existing.failures, windowStart);
  existing.failures.push(now);

  let thresholdExceeded = false;
  if (existing.failures.length >= THRESHOLD) {
    const lastAlert = existing.lastAlertAt ?? 0;
    if (now - lastAlert > ALERT_COOLDOWN_MS) {
      thresholdExceeded = true;
      existing.lastAlertAt = now;
    }
  }
  buckets.set(key, existing);
  return { count: existing.failures.length, thresholdExceeded };
}

/**
 * Reset the failure counter on a successful sign-in. Cheap; safe to call
 * unconditionally on every successful credentials sign-in.
 */
export function resetAdminLoginFailures(email: string): void {
  buckets.delete(email.trim().toLowerCase());
}

export const ADMIN_LOGIN_FAILURE_THRESHOLD = THRESHOLD;
