import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isPaymentVerified } from "@/lib/permissions";
import {
  AthleteConnectionStatus,
  FraudStatus,
  StudentConnectionStatus,
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
import {
  screenAllByUrl,
  FRAUD_USER_FACING_MESSAGE,
} from "@/lib/verification-fraud";
import {
  AUTO_APPROVE_THRESHOLD,
  buildProofsForRequest,
  countPassed,
  shouldAutoApprove,
} from "@/lib/verification-proofs";
import { applyVerificationApproval } from "@/lib/verification-approval";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";

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

  // -----------------------------------------------------------------
  // AI/fraud screen on every uploaded image BEFORE we persist the row.
  // - DENIED → reject the submission entirely (no DB write, user sees
  //   the generic fraud message; full details stay server-side).
  // - REVIEW_REQUIRED → persist with denormalized fraud fields so the
  //   admin queue can prioritize and surface the warning.
  // - CLEAR → persist with denormalized fraud fields = CLEAR, score 0-49.
  // Implementation note: the screen runs against URLs the user has
  // already uploaded to their own host (we never store the bytes here),
  // and degrades to REVIEW_REQUIRED on any network/provider failure so
  // a flaky provider can never silently lock users out.
  // Returns BOTH the worst fraud result (for the existing DENIED short-
  // circuit + denormalized summary fields) AND a per-URL map (consumed
  // by the proof builder so each piece of evidence gets its own status).
  const { worst: fraud, byUrl: fraudByUrl } = await screenAllByUrl({
    userId: session.user.id,
    urls: [
      data.rosterUrl || null,
      data.proofUrl || null,
      data.studentIdUrl || null,
      data.rosterScreenshotUrl || null,
    ],
    targetType: "verification",
    targetId: null,
  });
  if (fraud?.status === FraudStatus.DENIED) {
    // Never echo provider score / reason / model labels — they're
    // server-side only. The audit log already captured the full result.
    return NextResponse.json({ error: FRAUD_USER_FACING_MESSAGE }, { status: 422 });
  }

  // ------------------------------------------------------------------
  // Multi-proof scoring
  //
  // Build the list of proof rows from the form data + fraud results,
  // then decide whether this submission qualifies for the 3-proof auto-
  // approval path. The decision happens BEFORE the transaction so the
  // request can be written with the correct terminal status from the
  // start (no second update).
  //
  // PAYMENT_VERIFICATION + PRIOR_APPROVED_CONNECTION are derived from
  // user state, not the form — fetched here in parallel.
  // ------------------------------------------------------------------
  const [userForProofs, anyAthleteApproved, anyStudentApproved] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { paymentVerified: true, role: true },
    }),
    prisma.athleteProgramConnection.findFirst({
      where: { userId: session.user.id, status: AthleteConnectionStatus.APPROVED },
      select: { id: true },
    }),
    prisma.studentUniversityConnection.findFirst({
      where: { userId: session.user.id, status: StudentConnectionStatus.APPROVED },
      select: { id: true },
    }),
  ]);
  const hasPriorApprovedConnection = !!anyAthleteApproved || !!anyStudentApproved;

  const proofs = buildProofsForRequest({
    eduEmail: data.eduEmail || null,
    schoolEmailVerified,
    rosterUrl: data.rosterUrl || null,
    rosterScreenshotUrl: data.rosterScreenshotUrl || null,
    studentIdUrl: data.studentIdUrl || null,
    proofUrl: data.proofUrl || null,
    recruitingProfileUrl: data.recruitingProfileUrl || null,
    schoolDirectoryUrl: data.schoolDirectoryUrl || null,
    linkedinUrl: data.linkedinUrl || null,
    hudlUrl: data.hudlUrl || null,
    isParentRequest,
    paymentVerified: userForProofs.paymentVerified,
    hasPriorApprovedConnection,
    fraudByUrl,
  });
  const autoApprove = shouldAutoApprove(proofs);
  const passedCount = countPassed(proofs);

  // When auto-approving, the request is stamped APPROVED in the same
  // create. Otherwise we use the scorer's queue bucket as before.
  const finalRequestStatus = autoApprove
    ? VerificationRequestStatus.APPROVED
    : scored.status;
  const finalUserStatus = autoApprove
    ? VerificationStatus.VERIFIED
    : VerificationStatus.PENDING;

  // Transaction: parent request + proof rows + user-side updates all
  // commit together. Using the interactive variant so we can call the
  // shared approval helper inside.
  const created = await prisma.$transaction(async (tx) => {
    const req = await tx.verificationRequest.create({
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
        status: finalRequestStatus,
        attemptNumber: attempts + 1,
        // Stamp reviewedAt on the auto-approved path so the admin queue
        // can distinguish "auto-approved seconds after submit" from a
        // request that's been waiting for human review. reviewedBy stays
        // null — the same marker the approval helper uses to render
        // "(auto-approval)" downstream.
        reviewedAt: autoApprove ? new Date() : null,
        reviewedBy: null,
        // Denormalized fraud-screen summary. NULL when no images were
        // attached (e.g. .edu-only flow); admin UI treats NULL as
        // "not screened" rather than "passed".
        fraudStatus: fraud?.status ?? null,
        fraudScore: fraud?.score ?? null,
        fraudCheckedAt: fraud ? new Date() : null,
      },
      select: { id: true },
    });

    // Persist proof rows in one shot. createMany skips returning rows
    // (which we don't need) and is the cheapest write for N <= ~10.
    if (proofs.length > 0) {
      await tx.verificationProof.createMany({
        data: proofs.map((p) => ({
          requestId: req.id,
          proofType: p.proofType,
          status: p.status,
          fraudStatus: p.fraudStatus,
          fraudScore: p.fraudScore,
          checkedAt: p.checkedAt,
        })),
      });
    }

    if (autoApprove) {
      // Apply the same downstream side-effects the admin approve handler
      // would have applied — role flip, review-weight refresh, recruit
      // upgrade auto-connect. Shared helper keeps the two paths in lock-
      // step so a future change to "what happens on approval" doesn't
      // diverge between manual and auto.
      await applyVerificationApproval(
        tx,
        {
          id: req.id,
          userId: session.user.id,
          targetRole,
          sport: data.sport ?? null,
          universityId: data.universityId || null,
          universityName: data.universityName ?? null,
          schoolId: data.schoolId || null,
          rosterUrl: data.rosterUrl || null,
          user: { role: userForProofs.role },
        },
        { actorUserId: null }
      );
    } else {
      // Non-auto path: same behavior as before — user enters PENDING.
      await tx.user.update({
        where: { id: session.user.id },
        data: { verificationStatus: finalUserStatus },
      });
    }

    return req;
  });

  // Backfill the ImageFraudCheck.targetId for this request's checks.
  // The screen wrote them with targetId=null because the row didn't
  // exist yet; updating in bulk by hash is cheap and keeps the audit
  // chain intact for admins drilling in from the queue.
  if (fraud) {
    await prisma.imageFraudCheck.updateMany({
      where: {
        userId: session.user.id,
        targetType: "verification",
        targetId: null,
        // Tightened by createdAt so we don't backfill checks from an
        // older, unrelated submission that also had a null targetId.
        createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
      },
      data: { targetId: created.id },
    });
  }

  // Audit log for the auto-approval path. The manual-approval path is
  // logged in /api/admin/verifications/[id] under VERIFICATION_APPROVED,
  // so emitting our own key here keeps the two distinguishable in
  // analytics + post-incident review.
  if (autoApprove) {
    await logAdminAction({
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.VERIFICATION_AUTO_APPROVED_THREE_PROOFS,
      targetType: "VerificationRequest",
      targetId: created.id,
      metadata: {
        targetRole,
        passedCount,
        threshold: AUTO_APPROVE_THRESHOLD,
        proofTypes: proofs
          .filter((p) => p.status === "PASSED")
          .map((p) => p.proofType),
        fraudStatus: fraud?.status ?? null,
        fraudScore: fraud?.score ?? null,
      },
    });
  }

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
