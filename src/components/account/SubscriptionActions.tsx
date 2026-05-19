"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SubscriptionStatus } from "@prisma/client";

interface Props {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  periodEndIso: string | null;
  hasStripeCustomer: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return "the end of your billing period";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * All interactive bits of the manage-subscription card: cancel button +
 * confirmation modal, reactivate button, manage-billing-portal escape
 * hatch, and a transient confirmation banner on success.
 *
 * Lives next to <ManageSubscription> so the server component stays a
 * pure data-driven renderer.
 */
export function SubscriptionActions({
  status,
  cancelAtPeriodEnd: _cancelAtPeriodEnd, // reserved for future UI variants
  periodEndIso,
  hasStripeCustomer,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Auto-dismiss success toasts after a few seconds. Error stays put
  // until the user retries — losing the message would hide what failed.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Trap focus in the modal when it opens, ESC to dismiss. Tiny manual
  // implementation rather than pulling in a dialog library — the modal
  // is one-off and the team likes to keep client deps lean.
  useEffect(() => {
    if (!confirmOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [confirmOpen]);

  const callJson = useCallback(
    async (url: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(url, { method: "POST" });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          ok?: boolean;
        };
        if (!res.ok || body.error) {
          return { ok: false, error: body.error ?? `Request failed (${res.status})` };
        }
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Network error",
        };
      }
    },
    []
  );

  const handleCancel = useCallback(() => {
    setError(null);
    setConfirmOpen(false);
    startTransition(async () => {
      const r = await callJson("/api/stripe/cancel");
      if (!r.ok) {
        setError(r.error ?? "Failed to cancel.");
        return;
      }
      setToast("Cancellation scheduled. Access continues until your billing period ends.");
      // Re-fetch the page data so badge + copy update.
      router.refresh();
    });
  }, [callJson, router]);

  const handleReactivate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const r = await callJson("/api/stripe/reactivate");
      if (!r.ok) {
        setError(r.error ?? "Failed to reactivate.");
        return;
      }
      setToast("Subscription reactivated. You'll continue to be billed at the renewal date.");
      router.refresh();
    });
  }, [callJson, router]);

  const handlePortal = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/stripe/portal", { method: "POST" });
        const j = (await res.json()) as { url?: string; error?: string };
        if (j.url) {
          window.location.href = j.url;
        } else {
          setError(j.error ?? "Could not open billing portal.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      }
    });
  }, []);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === SubscriptionStatus.ACTIVE && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
            disabled={pending}
          >
            {pending ? "Working…" : "Cancel subscription"}
          </button>
        )}
        {status === SubscriptionStatus.CANCELED && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleReactivate}
            disabled={pending}
          >
            {pending ? "Working…" : "Reactivate subscription"}
          </button>
        )}
        {(status === SubscriptionStatus.EXPIRED ||
          status === SubscriptionStatus.FREE) && (
          <Link href="/pricing" className="btn-primary">
            View plans
          </Link>
        )}
        {hasStripeCustomer && (
          <button
            type="button"
            className="btn-ghost"
            onClick={handlePortal}
            disabled={pending}
          >
            {pending ? "Opening…" : "Open billing portal"}
          </button>
        )}
      </div>

      {toast && (
        <p
          role="status"
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {toast}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {error}
        </p>
      )}

      {/* Confirmation modal. Backdrop click + ESC + Cancel all dismiss. */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="cancel-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              Are you sure you want to cancel your subscription?
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>
                • You'll keep full access until{" "}
                <strong>{formatDate(periodEndIso)}</strong>.
              </li>
              <li>• Your account, reviews, and history are preserved.</li>
              <li>• You can reactivate any time before that date.</li>
              <li>
                • After that date, premium posting and review features turn
                off.
              </li>
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                Keep subscription
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleCancel}
                disabled={pending}
              >
                {pending ? "Canceling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
