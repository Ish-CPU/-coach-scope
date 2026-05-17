import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getSession,
  isAthleteTrustedRole,
  isRecruitRole,
  isStudentTrustedRole,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ConnectionForm } from "@/components/connections/ConnectionForm";
import { StudentConnectionForm } from "@/components/connections/StudentConnectionForm";
import {
  AthleteConnectionStatus,
  AthleteConnectionType,
  StudentConnectionStatus,
  StudentConnectionType,
  UserRole,
} from "@prisma/client";

export const dynamic = "force-dynamic";

const ATHLETE_TYPE_LABELS: Record<AthleteConnectionType, string> = {
  CURRENT_ATHLETE: "Current athlete",
  ATHLETE_ALUMNI: "Alumni",
  RECRUITED_BY: "Recruited by",
  TRANSFERRED_FROM: "Transferred from",
  COMMITTED: "Committed",
  WALK_ON: "Walk-on",
};

const STUDENT_TYPE_LABELS: Record<StudentConnectionType, string> = {
  CURRENT_STUDENT: "Current student",
  STUDENT_ALUMNI: "Alumni",
  ADMITTED_TO: "Admitted (didn't enroll)",
  TRANSFERRED_FROM: "Transferred from",
  VISITED_CAMPUS: "Visited campus",
};

const STATUS_TONE: Record<AthleteConnectionStatus | StudentConnectionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default async function ConnectionsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?callbackUrl=/connections");

  const isAdmin = session.user.role === UserRole.ADMIN || session.user.role === UserRole.MASTER_ADMIN;
  // Recruits use the athlete connection form too — but only for
  // RECRUITED_BY rows. The form filters connection types based on this
  // flag; the API does the same on submit so a recruit can never
  // actually create an insider (CURRENT_ATHLETE / ALUMNI / etc.) row.
  const isRecruit = isRecruitRole(session.user.role);
  const showAthlete = isAthleteTrustedRole(session.user.role) || isRecruit || isAdmin;
  const showStudent = isStudentTrustedRole(session.user.role) || isAdmin;

  if (!showAthlete && !showStudent) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl card p-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">Connections aren't available for your role</h1>
          <p className="mt-2 text-sm text-slate-600">
            Connections are how athletes and students prove which schools they're verified
            with. Switch your role to start adding connections.
          </p>
          <Link href="/onboarding" className="btn-primary mt-4 inline-flex">
            Update your role
          </Link>
        </div>
      </div>
    );
  }

  // Pull each side's connection rows in parallel. The university selectors
  // inside the forms are now live comboboxes (see ConnectionForm /
  // StudentConnectionForm) so we no longer pre-load every University row
  // server-side — that previously capped the dropdown at 250 alphabetical
  // entries and made bigger DBs look like they had only one or two
  // universities.
  const [athleteConnections, studentConnections] = await Promise.all([
    showAthlete
      ? prisma.athleteProgramConnection.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          include: {
            university: { select: { id: true, name: true, state: true } },
            school: { select: { id: true, sport: true } },
          },
        })
      : Promise.resolve([]),
    showStudent
      ? prisma.studentUniversityConnection.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          include: {
            university: { select: { id: true, name: true, state: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const totals = {
    athleteApproved: athleteConnections.filter((c) => c.status === "APPROVED").length,
    studentApproved: studentConnections.filter((c) => c.status === "APPROVED").length,
  };

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">My connections</h1>
        <p className="mt-2 text-sm text-slate-600">
          Connections are how MyUniversityVerified enforces "you can only
          review schools you're actually connected to." Add a connection here,
          an admin reviews it, and once approved it unlocks the right reviews
          for that school.
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {showAthlete && (
            <>
              <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                {athleteConnections.length} athlete connections
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800">
                {totals.athleteApproved} approved
              </span>
            </>
          )}
          {showStudent && (
            <>
              <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                {studentConnections.length} student connections
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800">
                {totals.studentApproved} approved
              </span>
            </>
          )}
        </div>

        {/* --- Athlete form --- */}
        {showAthlete && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Athlete program connections</h2>
            <p className="mt-1 text-xs text-slate-500">
              Insider connections (current / alumni / committed / walk-on / transferred-from)
              unlock coach + program reviews. RECRUITED_BY unlocks recruiting reviews only.
            </p>
            <div className="mt-4">
              <ConnectionForm recruitOnly={isRecruit} />
            </div>

            <div className="mt-4 space-y-2">
              {athleteConnections.length === 0 ? (
                <div className="card p-6 text-sm text-slate-500">
                  No athlete connections yet — add your first one above.
                </div>
              ) : (
                athleteConnections.map((c) => (
                  <div
                    key={c.id}
                    className="card flex flex-wrap items-start justify-between gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">
                        {c.university.name} — {c.school?.sport ?? c.sport}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-600">
                        {ATHLETE_TYPE_LABELS[c.connectionType]}
                        {c.startYear || c.endYear ? (
                          <>
                            {" · "}
                            {c.startYear ?? "?"}–{c.endYear ?? "present"}
                          </>
                        ) : null}
                      </div>
                      {(c.rosterUrl || c.recruitingProofUrl) && (
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          {c.rosterUrl && (
                            <a
                              href={c.rosterUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline hover:text-slate-800"
                            >
                              roster
                            </a>
                          )}
                          {c.recruitingProofUrl && (
                            <a
                              href={c.recruitingProofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline hover:text-slate-800"
                            >
                              proof
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[c.status]}`}
                    >
                      {c.status.toLowerCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* --- Student form --- */}
        {showStudent && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-slate-900">Student school connections</h2>
            <p className="mt-1 text-xs text-slate-500">
              Insider connections (current / alumni / transferred-from) unlock university
              and dorm reviews. ADMITTED_TO and VISITED_CAMPUS unlock admissions reviews only.
            </p>
            <div className="mt-4">
              <StudentConnectionForm />
            </div>

            <div className="mt-4 space-y-2">
              {studentConnections.length === 0 ? (
                <div className="card p-6 text-sm text-slate-500">
                  No student connections yet — add your first one above.
                </div>
              ) : (
                studentConnections.map((c) => (
                  <div
                    key={c.id}
                    className="card flex flex-wrap items-start justify-between gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">{c.university.name}</div>
                      <div className="mt-0.5 text-xs text-slate-600">
                        {STUDENT_TYPE_LABELS[c.connectionType]}
                        {c.startYear || c.endYear ? (
                          <>
                            {" · "}
                            {c.startYear ?? "?"}–{c.endYear ?? "present"}
                          </>
                        ) : null}
                      </div>
                      {(c.studentIdUrl || c.proofUrl || c.schoolEmail) && (
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          {c.schoolEmail && <span>{c.schoolEmail}</span>}
                          {c.studentIdUrl && (
                            <a
                              href={c.studentIdUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline hover:text-slate-800"
                            >
                              student ID
                            </a>
                          )}
                          {c.proofUrl && (
                            <a
                              href={c.proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline hover:text-slate-800"
                            >
                              proof
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[c.status]}`}
                    >
                      {c.status.toLowerCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        <p className="mt-8 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          Fake or AI-generated proof leads to rejection and account removal. Official roster
          / school-email / student-ID URLs are preferred wherever possible.
        </p>
      </div>
    </div>
  );
}
