import Link from "next/link";
import { redirect } from "next/navigation";
import {
  allowedReviewTypes,
  describeGate,
  getSession,
  whyCannotParticipate,
} from "@/lib/permissions";
import { ReviewForm } from "@/components/ReviewForm";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { ReviewType } from "@prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function get(sp: PageProps["searchParams"], k: string) {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Write-a-Review entry point.
 *
 * Server responsibilities here are intentionally narrow:
 *   1. Make sure the user is signed in and role-verified (page-level
 *      participation gate).
 *   2. Resolve which review types they're allowed to submit.
 *   3. Forward any deep-link initial values from the URL (coachId,
 *      schoolId, universityId, dormId).
 *
 * Everything else — searching universities, fetching programs, fetching
 * coaches, fetching dorms — is owned by the live combobox-chain inside
 * <ReviewForm>. We deliberately do NOT pre-scope target options to the
 * user's approved connections anymore: that produced confusing UX (e.g.
 * a recruit's dropdown showing only the two schools that recruited
 * them) and didn't actually buy us security since the per-target
 * permission gate runs at submit time inside /api/reviews via
 * `describeReviewBlock`. Submitting against a school the user lacks a
 * connection to returns a 403 with a clear rejection message that
 * <ReviewForm> surfaces verbatim.
 */
export default async function NewReviewPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?callbackUrl=/review/new");

  const gate = whyCannotParticipate(session);
  if (gate) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl space-y-4">
          {gate === "role-not-verified" ? (
            <div className="card p-6">
              <h2 className="text-lg font-semibold">Verify your role first</h2>
              <p className="mt-2 text-sm text-slate-600">
                Payment is complete — finish role verification to unlock posting.
              </p>
              <Link href="/verification" className="btn-primary mt-4 inline-flex">
                Continue verification
              </Link>
            </div>
          ) : (
            <UpgradePrompt message={describeGate(gate)} />
          )}
        </div>
      </div>
    );
  }

  const allowed = allowedReviewTypes(session);
  if (allowed.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl">
          <UpgradePrompt message="Your role does not allow posting reviews." />
        </div>
      </div>
    );
  }

  // Default review type: query param, else first allowed for the role.
  const requested = get(searchParams, "type") as ReviewType | undefined;
  const initialType: ReviewType = requested && allowed.includes(requested) ? requested : allowed[0];

  // Deep-link initial values — passed through to the form so we can
  // pre-seed the combobox chain (e.g. /coach/<id> → "Write a review"
  // arrives with coachId pre-populated).
  const coachId = get(searchParams, "coachId");
  const schoolId = get(searchParams, "schoolId");
  const universityId = get(searchParams, "universityId");
  const dormId = get(searchParams, "dormId");

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Write a review</h1>
        <p className="mt-1 text-sm text-slate-600">
          Be specific, fair, and based on your personal experience. No harassment, threats, or false claims.
        </p>

        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Search any university to start. If you don't have an approved connection
          to the program/coach/school you pick, the submit step will tell you
          which kind of connection you'd need first — visit{" "}
          <Link href="/connections" className="underline">
            /connections
          </Link>{" "}
          to add one.
        </p>

        <div className="mt-6">
          <ReviewForm
            initial={{
              reviewType: initialType,
              coachId,
              schoolId,
              universityId,
              dormId,
            }}
            allowed={allowed}
          />
        </div>
      </div>
    </div>
  );
}
