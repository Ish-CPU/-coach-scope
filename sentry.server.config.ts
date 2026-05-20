/**
 * Sentry — SERVER (Node runtime) configuration.
 *
 * Captures errors thrown in API route handlers, server components, and
 * server actions. The Sentry Next.js SDK wraps these surfaces
 * automatically once init() runs.
 *
 * USES SENTRY_DSN (server-side, not exposed to the client). The client
 * config uses NEXT_PUBLIC_SENTRY_DSN — same value is fine; the prefix
 * just controls which bundle includes it.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Don't capture Prisma "P2025 record not found" — that's a 404,
    // not a bug. Same for NextAuth's "CredentialsSignin" which fires
    // on every failed login attempt and would drown the dashboard.
    ignoreErrors: ["P2025", "CredentialsSignin"],
  });
}
