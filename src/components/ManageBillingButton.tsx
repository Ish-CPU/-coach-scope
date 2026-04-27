"use client";

import { useState } from "react";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      className="btn-secondary"
      onClick={async () => {
        setLoading(true);
        const res = await fetch("/api/stripe/portal", { method: "POST" });
        const j = await res.json();
        setLoading(false);
        if (j.url) window.location.href = j.url;
      }}
    >
      {loading ? "Opening…" : "Manage billing"}
    </button>
  );
}
