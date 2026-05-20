/**
 * Canonical version strings for our legal documents.
 *
 * Bumping either constant triggers the re-acceptance flow on next sign-
 * in: any user whose stored `termsAcceptedVersion` / `privacyAcceptedVersion`
 * doesn't match these gets a blocking modal asking them to re-accept.
 *
 * VERSIONING POLICY
 *   - Use the ISO date the new version goes live, e.g. "2026-05-20".
 *   - Bump for ANY material change (clauses added/removed, scope of data
 *     collection changed, fees added). Don't bump for typo fixes.
 *   - Keep the previous Markdown file in src/content/legal/ (e.g.
 *     terms-2026-05-20.md) so legal history is auditable.
 *
 * COORDINATING WITH YOUR LAWYER
 *   When your lawyer hands you new TOS / Privacy text:
 *     1. Save the rendered Markdown to src/content/legal/<name>-<date>.md
 *     2. Update the corresponding constant below to the new date string
 *     3. Update src/app/legal/terms/page.tsx (or privacy) to import the
 *        new file
 *     4. Deploy — every user is forced to re-accept on next sign-in
 */
export const CURRENT_TERMS_VERSION = "2026-05-20";
export const CURRENT_PRIVACY_VERSION = "2026-05-20";

/**
 * True when a user with the given accepted-version is current. Used by
 * the re-acceptance gate in the app shell.
 */
export function termsAreCurrent(version: string | null | undefined): boolean {
  return version === CURRENT_TERMS_VERSION;
}

export function privacyIsCurrent(version: string | null | undefined): boolean {
  return version === CURRENT_PRIVACY_VERSION;
}
