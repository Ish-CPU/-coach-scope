"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary scoped to /admin/* (staff route group). Catches render
 * failures inside a queue or detail page so the admin nav stays usable
 * (rendered by the layout above us) and an admin can route around the
 * broken page rather than getting bounced to the global error screen.
 *
 * `digest` is the Vercel error correlation ID — surface it so a user can
 * paste it into a bug report and we can find it in the runtime logs.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server logs already capture this via the digest; logging client-side
    // makes it easy to see in the browser console during a dev repro.
    // eslint-disable-next-line no-console
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-xl card p-6">
        <h2 className="text-lg font-bold text-slate-900">
          Something went wrong in the admin console.
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          The page failed to render. The error has been logged.
          {error.digest && (
            <>
              {" "}
              Reference:{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">
                {error.digest}
              </code>
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/admin" className="btn-secondary">
            Back to admin home
          </Link>
        </div>
      </div>
    </div>
  );
}
