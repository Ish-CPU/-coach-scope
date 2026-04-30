/**
 * Run a Prisma (or any async) query and return a fallback if it throws.
 *
 * Use this around every server-side DB call that's read-only. Production
 * symptoms it prevents:
 *   - DATABASE_URL unset / wrong → would otherwise bubble to the global
 *     error.tsx and show "Something went wrong."
 *   - Schema drift / missing table after a migration was forgotten.
 *   - A single bad query (timeout, bad index) crashing a list page.
 *
 * What it does NOT do:
 *   - Catch programming bugs (TypeError, ReferenceError) — those should
 *     still surface in dev and be reported in prod.
 *   - Hide write failures. Mutating routes should still surface errors so
 *     the UI can show "couldn't save." Use this only for reads.
 *
 * Errors are logged with `tag` so you can find them in your platform logs.
 */
export async function safe<T>(
  fn: () => Promise<T>,
  fallback: T,
  tag = "query"
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[safe:${tag}]`, err);
    return fallback;
  }
}
