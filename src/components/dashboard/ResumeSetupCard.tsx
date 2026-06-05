/**
 * Dashboard CTA shown when the user hasn't completed every "get started"
 * step yet. Renders nothing once they're done (or for admins/viewers).
 *
 * The card surfaces the NEXT undone step prominently and lists the
 * other steps as small ticked/unticked items, so the user knows where
 * they are in the flow without needing the full stepper bar (the
 * dedicated pages have the bar; here we want a single CTA).
 */
import Link from "next/link";
import { getGetStartedState } from "@/lib/get-started";

interface Props {
  userId: string;
}

export async function ResumeSetupCard({ userId }: Props) {
  const state = await getGetStartedState(userId);
  if (!state || state.allDone) return null;
  const { nextStep, steps } = state;
  if (!nextStep) return null;

  return (
    <section
      aria-label="Finish setting up your account"
      className="mb-6 rounded-2xl border border-brand-300 bg-gradient-to-br from-brand-50 to-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
            Finish setting up
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            {nextStep.label}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{nextStep.hint}</p>
        </div>
        <Link href={nextStep.href} className="btn-primary text-sm">
          Continue →
        </Link>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {steps.map((s) => (
          <li
            key={s.key}
            className={`inline-flex items-center gap-1.5 ${
              s.done ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                s.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
              }`}
              aria-hidden
            >
              {s.done ? "✓" : ""}
            </span>
            {s.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
