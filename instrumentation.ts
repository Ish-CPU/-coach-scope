/**
 * Next.js instrumentation hook — called ONCE per runtime when the
 * server starts. We use it to bootstrap Sentry for whichever runtime
 * Next is loading us into:
 *
 *   - "nodejs"  → standard API routes, server components, server actions
 *   - "edge"    → middleware + route handlers declared `runtime = "edge"`
 *
 * Sentry needs different SDK builds for each runtime; this file picks
 * the right one. If neither config sets a DSN, init is a no-op and
 * production keeps running normally — useful for local dev or preview
 * deploys where you don't want noise in the Sentry dashboard.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Catch React render errors thrown during request handling so they
 * land in Sentry alongside JS exceptions. Required for Next 15+.
 */
export const onRequestError = async (
  ...args: Parameters<
    typeof import("@sentry/nextjs").captureRequestError
  >
) => {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  }
};
