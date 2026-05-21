/**
 * Shared error-message helper for every verification form.
 *
 * The verification API returns errors in three shapes:
 *   - { error: "plain string message" }              — bespoke responses
 *   - { error: <Zod flattened error object> }        — validation failures
 *   - { error: <unknown> }                           — defensive catch-all
 *
 * Plus the form can hit network failures BEFORE getting a JSON body
 * back at all (offline, CORS, server crash).
 *
 * This helper turns any of those into a user-safe message. NEVER leaks:
 *   - fraud scores, provider names, AI-classifier internals
 *   - stack traces
 *   - field paths from the server (no "rosterUrl: required" telling
 *     fraudsters which fields exist)
 *
 * Public output is one of a small set of safe, intent-revealing
 * messages. Map common server messages to friendlier copy; everything
 * else falls back to the catch-all.
 */

const SAFE_FALLBACK =
  "We couldn't process this submission. Please double-check your inputs and try again.";

/**
 * Map a server-returned string error to a friendly user-facing version
 * when we can recognize it. Otherwise return the server message
 * verbatim (it's already a plain string — never structured data).
 */
function reframeKnownMessages(message: string): string {
  const m = message.toLowerCase();

  // Fraud / image-quality signals. The server's generic
  // FRAUD_USER_FACING_MESSAGE is intentionally vague (per the project
  // brief — don't tell fraudsters what tripped the model). We respect
  // that and just present it as-is, with optional user guidance.
  if (m.includes("couldn't verify") || m.includes("could not verify") || m.includes("verify this upload")) {
    return "This submission was rejected. Please upload a clearer, official document and try again.";
  }
  if (m.includes("too large") || m.includes("file size")) {
    return "The uploaded file is too large. Please use a smaller image (5MB max).";
  }
  if (m.includes("unsupported") && m.includes("type")) {
    return "Unsupported file type. Please upload a JPG, PNG, WebP, HEIC, or PDF.";
  }
  if (m.includes("blurry") || m.includes("unreadable")) {
    return "The uploaded document was unreadable. Please upload a clearer image.";
  }
  if (m.includes("does not match") || m.includes("did not match")) {
    return "The uploaded proof did not match the selected role. Please re-check or pick a different role.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many submissions. Please wait a few minutes before trying again.";
  }
  if (m.includes("pending request")) {
    return "You already have a verification request in review. Please wait for an admin response.";
  }
  if (m.includes("sign in")) {
    return "Please sign in to submit a verification request.";
  }

  // Server returned a plain string we don't have a friendlier version
  // of — pass it through. Server messages are already user-safe per
  // the API contract.
  return message;
}

/**
 * Given the parsed JSON body of a non-2xx fetch response, return a
 * single user-safe error string. Handles every shape the verification
 * API uses without ever showing the user a JSON blob or Zod field-path.
 */
export function getVerificationErrorMessage(
  body: unknown,
  fallback = SAFE_FALLBACK
): string {
  if (!body || typeof body !== "object") return fallback;
  const error = (body as { error?: unknown }).error;

  // Plain string — server's bespoke message. Reframe known patterns.
  if (typeof error === "string" && error.length > 0) {
    return reframeKnownMessages(error);
  }

  // Zod flatten() shape — { formErrors: string[], fieldErrors: {...} }.
  // We never surface field paths to users (don't tell fraudsters which
  // fields exist); we just say something failed and ask them to retry.
  if (error && typeof error === "object") {
    const formErrors = (error as { formErrors?: unknown }).formErrors;
    if (Array.isArray(formErrors) && formErrors.length > 0 && typeof formErrors[0] === "string") {
      return reframeKnownMessages(formErrors[0]);
    }
    const fieldErrors = (error as { fieldErrors?: Record<string, unknown> }).fieldErrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      for (const v of Object.values(fieldErrors)) {
        if (Array.isArray(v) && typeof v[0] === "string") {
          // Don't echo field-specific messages — just tell the user
          // their inputs need a re-check. Keeps the API surface opaque.
          return "Some of your inputs were invalid. Please review the form and try again.";
        }
      }
    }
  }

  return fallback;
}

/**
 * Map a fetch-level failure (network down, CORS, server timed out) to
 * a stable friendly message. Called when `fetch()` throws OR when
 * `response.json()` itself fails.
 */
export function getNetworkErrorMessage(): string {
  return "Couldn't reach the server. Check your connection and try again.";
}
