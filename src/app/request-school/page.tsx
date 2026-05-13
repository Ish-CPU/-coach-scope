import { RequestSchoolForm } from "./RequestSchoolForm";
import { SPORTS } from "@/lib/sports";
import { DIVISION_OPTIONS } from "@/lib/division";

export const dynamic = "force-static";

export const metadata = {
  title: "Request your school | RateMyU",
  description:
    "Don't see your school or program on RateMyU? Tell us about it and we'll add it.",
};

interface PageProps {
  // Accept either `?q=…` (from the search empty-state CTA) or the older
  // `?prefill=…` form so existing links keep working.
  searchParams: { q?: string; prefill?: string };
}

export default function RequestSchoolPage({ searchParams }: PageProps) {
  const raw = searchParams.q ?? searchParams.prefill;
  const prefill = typeof raw === "string" ? raw.slice(0, 200) : undefined;

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Don&rsquo;t see your school?
        </h1>
        <p className="mt-2 text-slate-600">
          RateMyU is built by athletes, students, and parents. If your school or
          program isn&rsquo;t in the database yet, request it below — we&rsquo;ll
          import it from official sources and let you know when it&rsquo;s live.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Submissions are reviewed by an admin. We use only public, official
          data when adding a new school.
        </p>

        <div className="card mt-6 p-6">
          <RequestSchoolForm
            sports={SPORTS as readonly string[] as string[]}
            divisions={DIVISION_OPTIONS}
            initialSchoolName={prefill}
          />
        </div>
      </div>
    </div>
  );
}
