/**
 * Environment-variable helpers.
 *
 * We deliberately *do not* throw at module-import time, because:
 *  - Build / `prisma generate` runs without secrets.
 *  - Lint / type-check shouldn't depend on a populated .env.
 *
 * Instead we throw at the call site that actually needs the secret, which
 * gives a useful 500 with a clear message instead of a silent
 * "sk_test_placeholder" being shipped to Stripe.
 *
 * Boot-time check: see `assertProductionEnv()` below, called from
 * `src/app/layout.tsx` so a misconfigured production deploy fails the first
 * request loudly instead of silently issuing unverifiable JWTs / placeholder
 * Stripe keys / etc.
 */

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : undefined;
}

export function appUrl(): string {
  return optionalEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
}

/**
 * Production-only assertion that the auth secret is set. Called from the
 * sign-in handler so a misconfigured deploy fails loudly instead of issuing
 * unverifiable JWTs.
 */
export function assertAuthSecretConfigured(): void {
  if (process.env.NODE_ENV === "production" && !optionalEnv("NEXTAUTH_SECRET")) {
    throw new Error("NEXTAUTH_SECRET is required in production.");
  }
}

/**
 * Required-in-production env vars. Used by `assertProductionEnv()` (called
 * once at boot from the root layout) so a misconfigured deploy surfaces on
 * the first request with one clear error, instead of failing per-feature.
 *
 * Optional in production (no throw, but features degrade):
 *   STRIPE_PRICE_MONTHLY_ID / STRIPE_PRICE_YEARLY_ID — checkout still works
 *     for whichever interval is configured.
 *   RESEND_API_KEY / EMAIL_FROM — outbound email silently no-ops; admin
 *     queues + audit log still capture everything else.
 *   MASTER_ADMIN_EMAIL — only consulted on seed; not needed at runtime.
 */
const REQUIRED_IN_PROD = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

/**
 * Throw once, with a list of every missing var, when running in production.
 * In dev / preview / test we only warn so local work isn't blocked.
 *
 * Idempotent: the first call validates, subsequent calls are no-ops. Safe to
 * import-and-call from a hot path; the work is a single Set lookup after the
 * first invocation.
 *
 * IMPORTANT: skips during `next build`. Next collects page data with
 * NODE_ENV=production but without runtime secrets, so we'd block every
 * build. The `NEXT_PHASE` env var Next sets is the documented escape hatch.
 */
let _envCheckRan = false;
export function assertProductionEnv(): void {
  if (_envCheckRan) return;
  _envCheckRan = true;

  // Don't run during `next build` page-data collection / static analysis.
  // The check should fire on the first real request in production.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const missing = REQUIRED_IN_PROD.filter((k) => !optionalEnv(k));
  if (missing.length === 0) return;

  const message = `Missing required env vars: ${missing.join(", ")}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }
  // eslint-disable-next-line no-console
  console.warn(`[env] ${message} — required for production deploys.`);
}
