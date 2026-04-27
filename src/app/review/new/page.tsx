import Link from "next/link";
import { redirect } from "next/navigation";
import {
  allowedReviewTypes,
  describeGate,
  getSession,
  whyCannotParticipate,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
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

  const coachId = get(searchParams, "coachId");
  const schoolId = get(searchParams, "schoolId");
  const universityId = get(searchParams, "universityId");
  const dormId = get(searchParams, "dormId");

  const [coaches, universities, dorms] = await Promise.all([
    prisma.coach.findMany({
      take: 200,
      orderBy: { name: "asc" },
      include: { school: { include: { university: true } } },
    }),
    prisma.university.findMany({ take: 200, orderBy: { name: "asc" } }),
    prisma.dorm.findMany({ take: 200, orderBy: { name: "asc" }, include: { university: true } }),
  ]);

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Write a review</h1>
        <p className="mt-1 text-sm text-slate-600">
          Be specific, fair, and based on your personal experience. No harassment, threats, or false claims.
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
            options={{
              coaches: coaches.map((c) => ({
                id: c.id,
                label: `${c.name} — ${c.school.sport} · ${c.school.university.name}`,
                schoolId: c.schoolId,
              })),
              universities: universities.map((u) => ({ id: u.id, label: u.name })),
              dorms: dorms.map((d) => ({ id: d.id, label: `${d.name} (${d.university.name})` })),
            }}
            allowed={allowed}
          />
        </div>
      </div>
    </div>
  );
}
