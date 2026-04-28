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
