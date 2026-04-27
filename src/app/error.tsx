"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <h2 className="text-2xl font-bold">Something went wrong.</h2>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        We've logged the error. You can try again, or head back to the homepage.
      </p>
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="btn-primary">Try again</button>
        <a href="/" className="btn-secondary">Go home</a>
      </div>
    </div>
  );
}
