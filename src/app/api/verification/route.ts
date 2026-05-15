import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isPaymentVerified } from "@/lib/permissions";
import {
  UserRole,
  VerificationMethod,
  VerificationRequestStatus,
  VerificationStatus,
} from "@prisma/client";
import {
  MAX_VERIFICATION_ATTEMPTS_24H,
  parseEduEmail,
  recentAttemptCount,
  rosterUrlLooksOfficial,
} from "@/lib/verification";
import { scoreVerification } from "@/lib/verification-confidence";
import { rateLimit } from "@/lib/rate-limit";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { sendVerificationRequestEmail } from "@/lib/email/notifications";

const schema = z.object({
  method: z.nativeEnum(VerificationMethod),
  // Optional upgrade target. Only meaningful for VERIFIED_RECRUIT users
  // transitioning to an athlete-trusted role (CURRENT or ALUMNI). Other
  // roles ignore this field — the request always targets the user's
  // current role for them. Constrained server-side below.
  targetRole: z
    .enum([UserRole.VERIFIED_ATHLETE, UserRole.VERIFIED_ATHLETE_ALUMNI])
    .optional(),
  eduEmail: z.string().email().optional().or(z.literal("")),
  rosterUrl: z.string().url().optional().or(z.literal("")),
  proofUrl: z.string().url().optional().or(z.literal("")),
  // Structured athlete / alumni proof fields. Validated per-role below.
  sport: z.string().trim().min(1).max(80).optional(),
  universityName: z.string().trim().min(1).max(140).optional(),
  // IDs from the shared UniversityCombobox / ProgramCombobox. Optional —
  // verification can still proceed for schools not yet in our DB (admin
  // approves manually). When supplied, the admin approval handler uses
  // them directly instead of fuzzy-matching universityName.
  universityId: z.string().cuid().optional().or(z.literal("")),
  schoolId: z.string().cuid().optional().or(z.literal("")),
  studentIdUrl: z.string().url().optional().or(z.literal("")),
  rosterScreenshotUrl: z.string().url().optional().or(z.literal("")),
  gradYear: z.number().int().min(1950).max(2100).optional(),
  playingYears: z.string().trim().max(40).optional(),
  // External profile cross-checks. All optional. Surfaced verbatim on the
  // admin scorecard.
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  hudlUrl: z.string().url().optional().or(z.literal("")),
  recruitingProfileUrl: z.string().url().optional().or(z.literal("")),
  schoolDirectoryUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const isAdmin = session.user.role === UserRole.ADMIN || session.user.role === UserRole.MASTER_ADMIN;
  // Payment-gating intentionally not enforced in MVP — Stripe is not wired
  // yet. Re-add the `isPaymentVerified` gate here when subscriptions ship.
  void isPaymentVerified;

  // Burst protection in addition to the 24h attempt cap below.
  const limited = rateLimit(req, "verification:submit", {
    max: 10,
    windowMs: 10 * 60_000,
    identifier: session.user.id,
  });
  if (limited) return limited;

  // Anti-fake throttle
  const attempts = await recentAttemptCount(session.user.id);
  if (attempts >= MAX_VERIFICATION_ATTEMPTS_24H && !isAdmin) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please contact support." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const role = session.user.role;

  // Resolve the request's `targetRole`:
  //   - VERIFIED_RECRUIT users *may* upgrade to VERIFIED_ATHLETE or
  //     VERIFIED_ATHLETE_ALUMNI (transfer recruits can target alumni when
  //     verifying for a former program). Any other supplied targetRole is
  //     rejected — we don't allow free-form role jumps.
  //   - All other roles target their own current role (existing behavior).
  // The admin approval handler reads VerificationRequest.targetRole to
  // decide whether to flip user.role on approve.
  let targetRole = role;
  const isRecruitUpgrade =
    role === UserRole.VERIFIED_RECRUIT &&
    !!data.targetRole &&
    (data.targetRole === UserRole.VERIFIED_ATHLETE ||
      data.targetRole === UserRole.VERIFIED_ATHLETE_ALUMNI);
  if (isRecruitUpgrade) {
    targetRole = data.targetRole!;
  } else if (data.targetRole && data.targetRole !== role) {
    return NextResponse.json(
      {
        error:
          "targetRole upgrades are only allowed for verified recruits stepping up to athlete.",
      },
      { status: 400 }
    );
  }

  // Method-vs-role validation.
  // Students AND student alumni may verify by .edu code OR by uploading a
  // student ID / alumni documentation (PROOF_UPLOAD).
  if (
    (role === UserRole.VERIFIED_STUDENT || role === UserRole.VERIFIED_STUDENT_ALUMNI) &&
    data.method !== VerificationMethod.EDU_EMAIL &&
    data.method !== VerificationMethod.PROOF_UPLOAD
  ) {
    return NextResponse.json(
      {
        error:
          role === UserRole.VERIFIED_STUDENT_ALUMNI
            ? "Student alumni verify with a .edu email or alumni documentation upload."
            : "Students verify with their .edu email or a student ID upload.",
      },
      { status: 400 }
    );
  }
  if (role === UserRole.VERIFIED_PARENT && data.method !== VerificationMethod.PARENT_DOC && data.method !== VerificationMethod.EDU_EMAIL) {
    return NextResponse.json(
      { error: "Parents verify with email or a parent-of-athlete document." },
      { status: 400 }
    );
  }

  // Recruits verify exclusively via PROOF_UPLOAD with structured fields.
  // Spec proof types: official visit / camp invite / staff DM / recruiting
  // questionnaire / offer letter / roster or recruiting profile link. They
  // map onto the existing schema fields rather than adding new columns:
  //   `proofUrl`               — primary recruiting proof (visit, invite,
  //                               DM screenshot, offer, questionnaire)
  //   `recruitingProfileUrl`   — recruiting profile (247 / On3 / NCSA / etc.)
  // At least ONE of those must be present, plus the structured sport +
  // university context so admins can sanity-check the recruiting story.
  // Recruit *initial* verification — only relevant when the user isn't
  // upgrading. The upgrade path (recruit → athlete) reuses the athlete
  // validation block below since the evidence is roster + student ID,
  // not recruiting outreach.
  if (role === UserRole.VERIFIED_RECRUIT && !isRecruitUpgrade) {
    if (data.method !== VerificationMethod.PROOF_UPLOAD) {
      return NextResponse.json(
        { error: "Recruits verify with structured proof — choose 'Recruiting Proof Upload'." },
        { status: 400 }
      );
    }
    if (!data.sport) {
      return NextResponse.json(
        { error: "Sport is required for recruit verification." },
        { status: 400 }
      );
    }
    if (!data.universityName) {
      return NextResponse.json(
        { error: "Recruiting school / university is required." },
        { status: 400 }
      );
    }
    if (!data.proofUrl && !data.recruitingProfileUrl) {
      return NextResponse.json(
        {
          error:
            "Provide at least one recruiting proof URL — official visit, camp invite, staff DM screenshot, recruiting questionnaire, offer letter, or your recruiting profile (247 / On3 / NCSA / etc.).",
        },
        { status: 400 }
      );
    }
  }

  // Athlete + alumni: require structured identity context for any non-email method.
  // Recruit-to-athlete upgrade requests use the SAME validation surface as
  // a fresh athlete verification — sport + university + at least one
  // identity image — so the admin scorecard sees the same fields no matter
  // how the user got there.
  const isAthleteOrAlumni =
    role === UserRole.VERIFIED_ATHLETE ||
    role === UserRole.VERIFIED_ATHLETE_ALUMNI ||
    isRecruitUpgrade;
  if (
    isAthleteOrAlumni &&
    data.method !== VerificationMethod.EDU_EMAIL
  ) {
    if (!data.sport) {
      return NextResponse.json({ error: "Sport is required for athlete verification." }, { status: 400 });
    }
    if (!data.universityName) {
      return NextResponse.json({ error: "School / university is required." }, { status: 400 });
    }
    // Current athletes MUST upload a student ID. Alumni may substitute alumni
    // documentation in the same field but at least one identity image must be
    // present alongside any roster/proof URL.
    if (role === UserRole.VERIFIED_ATHLETE && !data.studentIdUrl) {
      return NextResponse.json(
        { error: "Student ID upload URL is required for current athletes." },
        { status: 400 }
      );
    }
    if (
      role === UserRole.VERIFIED_ATHLETE_ALUMNI &&
      !data.studentIdUrl &&
      !data.rosterUrl &&
      !data.proofUrl
    ) {
      return NextResponse.json(
        { error: "Provide a roster URL, alumni documentation URL, or supporting proof URL." },
        { status: 400 }
      );
    }
  }

  // Inline checks for athlete proof submissions.
  if (data.method === VerificationMethod.EDU_EMAIL && data.eduEmail) {
    const parsedEmail = parseEduEmail(data.eduEmail);
    if (!parsedEmail.ok) {
      return NextResponse.json({ error: parsedEmail.reason }, { status: 400 });
    }
  }
  if (data.method === VerificationMethod.ROSTER_LINK) {
    if (!data.rosterUrl || !rosterUrlLooksOfficial(data.rosterUrl)) {
      return NextResponse.json(
        { error: "Provide an official athletics roster URL (school .edu / official athletics site)." },
        { status: 400 }
      );
    }
  }
  if (
    (data.method === VerificationMethod.PROOF_UPLOAD || data.method === VerificationMethod.PARENT_DOC) &&
    data.proofUrl &&
    !isSafeHttpUrl(data.proofUrl)
  ) {
    return NextResponse.json(
      { error: "Proof URL must be a public http(s) link, not a shortener or Drive link." },
      { status: 400 }
    );
  }

  const isParentRequest = role === UserRole.VERIFIED_PARENT;

  // Block duplicate pending requests
  const existingPending = await prisma.verificationRequest.findFirst({
    where: { userId: session.user.id, status: VerificationStatus.PENDING },
  });
  if (existingPending) {
    return NextResponse.json({ error: "You already have a pending request." }, { status: 409 });
  }

  // For EDU_EMAIL submissions the front-end has already round-tripped a
  // 6-digit code via /api/verification/code/* — treat the school email as
  // verified at submit time. For other methods the boolean stays false
  // until an admin manually confirms via the scorecard.
  const schoolEmailVerified =
    data.method === VerificationMethod.EDU_EMAIL && !!data.eduEmail;

  // Auto-confidence: persist a score + bucketed status so admins can sort
  // the queue by "obviously real" first.
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });
  const scored = scoreVerification({
    method: data.method,
    userName: account?.name ?? null,
    universityName: data.universityName ?? null,
    sport: data.sport ?? null,
    rosterUrl: data.rosterUrl || null,
    proofUrl: data.proofUrl || null,
    studentIdUrl: data.studentIdUrl || null,
    rosterScreenshotUrl: data.rosterScreenshotUrl || null,
    linkedinUrl: data.linkedinUrl || null,
    hudlUrl: data.hudlUrl || null,
    recruitingProfileUrl: data.recruitingProfileUrl || null,
    schoolDirectoryUrl: data.schoolDirectoryUrl || null,
    eduEmail: data.eduEmail || null,
    schoolEmailVerified,
  });

  const [created] = await prisma.$transaction([
    prisma.verificationRequest.create({
      data: {
        userId: session.user.id,
        // For non-upgrade flows targetRole === role (existing behavior).
        // For recruit-to-athlete upgrades it's the upgrade target so the
        // admin approval handler knows to flip user.role on approve.
        targetRole: targetRole,
        method: data.method,
        isParentRequest,
        eduEmail: data.eduEmail || null,
        rosterUrl: data.rosterUrl || null,
        proofUrl: data.proofUrl || null,
        sport: data.sport ?? null,
        universityName: data.universityName ?? null,
        // Persist the structured IDs alongside the display strings so
        // admin tooling can use either path. Empty string from the
        // combobox is coerced to null.
        universityId: data.universityId || null,
        schoolId: data.schoolId || null,
        studentIdUrl: data.studentIdUrl || null,
        rosterScreenshotUrl: data.rosterScreenshotUrl || null,
        gradYear: data.gradYear ?? null,
        playingYears: data.playingYears || null,
        linkedinUrl: data.linkedinUrl || null,
        hudlUrl: data.hudlUrl || null,
        recruitingProfileUrl: data.recruitingProfileUrl || null,
        schoolDirectoryUrl: data.schoolDirectoryUrl || null,
        schoolEmailVerified,
        confidenceScore: scored.score,
        notes: data.notes || null,
        status: scored.status,
        attemptNumber: attempts + 1,
      },
      select: { id: true },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { verificationStatus: VerificationStatus.PENDING },
    }),
  ]);

  // eslint-disable-next-line no-console
  console.info("[api/verification] created", {
    requestId: created.id,
    userId: session.user.id,
    role,
    targetRole,
    method: data.method,
    universityId: data.universityId || null,
    schoolId: data.schoolId || null,
    universityName: data.universityName ?? null,
    sport: data.sport ?? null,
  });

  // Fire admin notification — fire-and-forget so the user response isn't
  // blocked by SMTP latency. The helper handles its own logging + retries.
  void sendVerificationRequestEmail({
    requestId: created.id,
    userName: account?.name ?? null,
    userEmail: session.user.email ?? null,
    targetRole: role,
    university: data.universityName ?? null,
    sport: data.sport ?? null,
  });

  return NextResponse.json({
    ok: true,
    confidence: scored.status,
    score: scored.score,
    note:
      scored.status === VerificationRequestStatus.HIGH_CONFIDENCE
        ? "Submitted — looks legit on the auto-checks. Admin will confirm shortly."
        : scored.status === VerificationRequestStatus.LOW_CONFIDENCE
        ? "Submitted — but our auto-checks flagged a possible mismatch. An admin will review carefully."
        : data.method === VerificationMethod.PROOF_UPLOAD
        ? "Manual proof submitted — admin review is required (uploads are never auto-approved)."
        : "Submitted for review.",
  });
}
