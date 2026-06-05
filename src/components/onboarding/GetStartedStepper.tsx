/**
 * Renders the post-payment "get started" progress bar at the top of
 * /verification, /connections, etc. The page tells us which step it
 * represents via `currentStepKey`; we read user state on the server
 * via getGetStartedState() and render done/current/pending pills.
 *
 * Renders nothing (returns null) when:
 *   - The user's role isn't eligible (admin / viewer / unset)
 *   - The user has already completed every step
 *
 * Why server-rendered: state comes from the same DB the page already
 * reads from. No client-side flicker, no roundtrip, no auth.js getSession
 * call from a client hook.
 *
 * The bar is purely informational — every step links to its page and is
 * always clickable, even if "done." Re-verifying or adding a second
 * connection is fine, just don't put it in your face after you've
 * already done it.
 */
import Link from "next/link";
import { getGetStartedState, type StepKey } from "@/lib/get-started";

interface Props {
  userId: string;
  /** The current page's step. Highlights as "in progress." */
  currentStepKey: StepKey;
}

export async function GetStartedStepper({ userId, currentStepKey }: Props) {
  const state = await getGetStartedState(userId);

  // Skip rendering for ineligible roles (admin / viewer) or when the
  // user has already completed every step. Once they're done we don't
  // want a permanent "100%" banner cluttering every page.
  if (!state || state.allDone) return null;

  return (
    <section
      aria-label="Getting started progress"
      className="mx-auto mb-6 max-w-3xl rounded-2xl border border-brand-200 bg-brand-50/50 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">
          Get started
        </h2>
        <p className="text-xs text-slate-600">
          Step{" "}
          {state.steps.findIndex((s) => s.key === currentStepKey) + 1} of{" "}
          {state.steps.length}
        </p>
      </div>

      <ol className="mt-3 flex flex-wrap gap-2">
        {state.steps.map((s, idx) => {
          const isCurrent = s.key === currentStepKey;
          const isDone = s.done;
          // Visual states:
          //   done    — green tick, muted background, still a link
          //   current — solid brand background, white text (in progress)
          //   pending — outlined, slate text
          const cls = isCurrent
            ? "border-brand-600 bg-brand-600 text-white"
            : isDone
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${cls}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                      ? "bg-white text-brand-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                  aria-hidden
                >
                  {isDone ? "✓" : idx + 1}
                </span>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Hint surfaces the active step's "what to do here" copy so the
          user doesn't have to scan the page below to figure out the ask.
          Falls back to the next-undone step's hint when the user is on
          a page whose step is already done (e.g. they revisited
          /verification after approval). */}
      {(() => {
        const current = state.steps.find((s) => s.key === currentStepKey);
        const hintStep = current && !current.done ? current : state.nextStep;
        if (!hintStep) return null;
        return (
          <p className="mt-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Next:</span>{" "}
            {hintStep.hint}
            {hintStep.key !== currentStepKey && (
              <>
                {" "}
                <Link
                  href={hintStep.href}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  Go →
                </Link>
              </>
            )}
          </p>
        );
      })()}
    </section>
  );
}
