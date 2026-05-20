/**
 * Sentry — EDGE runtime configuration.
 *
 * Covers Next.js middleware + any route handlers declared with
 * `export const runtime = "edge"`. Slimmer than the server config —
 * the edge runtime doesn't have full Node APIs so Sentry runs a
 * stripped-down integration set automatically.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}
