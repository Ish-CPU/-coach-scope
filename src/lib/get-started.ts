/**
 * Computes the "getting started" step state for a single user. The
 * /verification and /connections pages render the stepper at the top,
 * and the dashboard shows a "Resume setup" card when any step is
 * incomplete — both surfaces share this one helper so they always
 * agree on which step the user is on.
 *
 * The three steps:
 *   1. VERIFY  — prove your role (always relevant for paying users)
 *   2. CONNECT — link to a specific program / university (athletes,
 *                students, and their alumni variants only)
 *   3. EXPLORE — post a first review (relevant for every participation
 *                role; "done" once they have any review)
 *
 * Why it's a function not a constant:
 *   Whether step 2 is relevant depends on the user's role. Parents
 *   and recruits don't have a roster/university to connect to in
 *   the same way (a parent's claim is the parent-of relationship,
 *   not a roster; a recruit isn't enrolled yet). For those roles the
 *   stepper collapses to 2 steps (verify → explore) so we don't show
 *   a "skip" step that can never be checked off.
 *
 * Data shape returned: an ordered array of steps. Each carries:
 *   key   — stable identifier the page uses to highlight its step
 *   label — short title rendered in the bar
 *   href  — where clicking that step sends them
 *   done  — true when the user has satisfied the step
 */
import { prisma } from "@/lib/prisma";
import {
  AthleteConnectionStatus,
  StudentConnectionStatus,
  UserRole,
  VerificationStatus,
} from "@prisma/client";

export type StepKey = "verify" | "connect" | "explore";

export interface Step {
  key: StepKey;
  label: string;
  href: string;
  done: boolean;
  /** Short human-readable hint shown under the label on the active step. */
  hint: string;
}

export interface GetStartedState {
  /** Ordered list of steps relevant to this user. */
  steps: Step[];
  /** The first not-done step, or null if every step is done. */
  nextStep: Step | null;
  /** True when every relevant step is complete. */
  allDone: boolean;
}

/** Roles that have a roster / university connection step in the stepper. */
function roleHasConnectStep(role: UserRole): boolean {
  return (
    role === UserRole.VERIFIED_ATHLETE ||
    role === UserRole.VERIFIED_ATHLETE_ALUMNI ||
    role === UserRole.VERIFIED_STUDENT ||
    role === UserRole.VERIFIED_STUDENT_ALUMNI
  );
}

/**
 * Roles eligible for the stepper at all. Admins, viewers, and unset
 * roles get a null/empty result — the calling page is expected to skip
 * rendering the stepper for them.
 */
function roleEligibleForStepper(role: UserRole): boolean {
  return (
    role !== UserRole.ADMIN &&
    role !== UserRole.MASTER_ADMIN &&
    role !== UserRole.VIEWER
  );
}

export async function getGetStartedState(userId: string): Promise<GetStartedState | null> {
  // One round-trip — the three queries we need run in parallel.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, verificationStatus: true },
  });
  if (!user) return null;
  if (!roleEligibleForStepper(user.role)) return null;

  const [approvedAthleteConn, approvedStudentConn, reviewCount] = await Promise.all([
    prisma.athleteProgramConnection.count({
      where: { userId, status: AthleteConnectionStatus.APPROVED },
    }),
    prisma.studentUniversityConnection.count({
      where: { userId, status: StudentConnectionStatus.APPROVED },
    }),
    // Review uses `authorId` (not `userId`) for the back-reference.
    prisma.review.count({ where: { authorId: userId } }),
  ]);

  const verifyDone = user.verificationStatus === VerificationStatus.VERIFIED;
  const connectDone = approvedAthleteConn + approvedStudentConn > 0;
  const exploreDone = reviewCount > 0;

  const steps: Step[] = [
    {
      key: "verify",
      label: "Verify your role",
      href: "/verification",
      done: verifyDone,
      hint: "Submit proof so your reviews count.",
    },
  ];

  if (roleHasConnectStep(user.role)) {
    steps.push({
      key: "connect",
      label: "Connect to your school",
      href: "/connections",
      done: connectDone,
      hint: "Link to your specific program or university.",
    });
  }

  steps.push({
    key: "explore",
    label: "Post your first review",
    href: "/search",
    done: exploreDone,
    hint: "Find a coach, program, or dorm and share your experience.",
  });

  const nextStep = steps.find((s) => !s.done) ?? null;

  return {
    steps,
    nextStep,
    allDone: nextStep === null,
  };
}
