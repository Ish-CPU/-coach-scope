/**
 * Sentry — CLIENT (browser) runtime.
 *
 * This is the Next 15+ canonical location for client-runtime Sentry
 * init (previously `sentry.client.config.ts`, deprecated for Turbopack
 * compatibility). The file is auto-loaded by Next at boot — no import
 * required anywhere else in the app.
 *
 * Captures uncaught errors + unhandled promise rejections from the
 * browser side of the app: React render errors, async user-action
 * failures, Next.js client-router crashes, etc.
 *
 * No-op when NEXT_PUBLIC_SENTRY_DSN isn't set, so local dev + preview
 * deployments without keys still work fine.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // 1.0 sends every error; tune down once volume justifies sampling.
    // Performance traces are sampled MUCH lower (10%) because they're
    // billed per-transaction and not all of them are equally useful.
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
    // Tag every event with environment so the Sentry dashboard can
    // filter prod vs. preview vs. dev cleanly.
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // Suppress noisy non-actionable events:
    //   - ResizeObserver loop is benign, fires constantly on some browsers
    //   - Network errors from cancelled fetches (navigation away during load)
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Network request failed",
      "Load failed",
      "AbortError",
    ],
    // Don't send breadcrumbs for routine client-router transitions —
    // signal-to-noise win on every captured error.
    beforeSend(event) {
      if (event.transaction === "_next/static/...") return null;
      return event;
    },
  });
}

/**
 * Required for Next 15+ App Router client-side navigation tracing.
 * Without this export, Sentry can't tie client-router transitions to
 * the right transaction in the dashboard.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
