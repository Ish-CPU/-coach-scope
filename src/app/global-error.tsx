"use client";

/**
 * Global error boundary for the App Router.
 *
 * Next.js calls this component when a render error escapes every
 * nested error boundary in the tree — i.e. the LAST line of defense
 * before the user sees a blank page. Two responsibilities:
 *
 *   1. Report the error to Sentry so we know it happened. Without this,
 *      uncaught render errors don't reach the Sentry dashboard at all —
 *      `instrumentation.onRequestError` handles server-side failures
 *      but client-side render bombs need this file.
 *
 *   2. Show a graceful "something went wrong" page with a Try Again
 *      button (the `reset` prop re-renders the failing subtree). The
 *      copy is intentionally generic — never expose `error.message` or
 *      stack traces to end users.
 *
 * MUST be a Client Component (the "use client" above) AND include its
 * own <html>/<body> tags — the root layout is bypassed when this
 * renders. Don't import the site header / footer here.
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Sentry's nextjs SDK exposes a dedicated capture helper for App
    // Router render errors. The `digest` it carries pairs server-side
    // and client-side log lines in the Sentry dashboard.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            color: "#0f172a",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              textAlign: "center",
              background: "white",
              borderRadius: 16,
              padding: "2rem 1.5rem",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
            }}
          >
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#64748b",
                marginTop: "0.5rem",
                marginBottom: "1.25rem",
              }}
            >
              We&apos;ve been notified. Try again — if the problem
              persists, please refresh the page or come back in a few
              minutes.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#1f58e6",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
