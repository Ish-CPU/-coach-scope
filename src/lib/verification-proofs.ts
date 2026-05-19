// ---------------------------------------------------------------------------
// Multi-proof verification scoring
// ---------------------------------------------------------------------------
//
// Builds the per-proof rows for a VerificationRequest from the data the
// user submitted, the per-image fraud-screen results we just computed,
// and a small amount of pre-fetched user context (active subscription +
// existing approved connections).
//
// AUTO-APPROVAL RULE:
//   If >= AUTO_APPROVE_THRESHOLD proofs reach PASSED on the same request
//   AND no proof is in REVIEW_REQUIRED, the submission auto-approves —
//   user.role + verificationStatus flip immediately, request.status =
//   APPROVED, audit log key VERIFICATION_AUTO_APPROVED_THREE_PROOFS.
//
// HARD RULES (mirror the product brief):
//   - A REVIEW_REQUIRED proof blocks auto-approval even at 3+ PASSED.
//   - A DENIED image fraud result short-circuits earlier in the request
//     handler — those uploads never reach the proof builder.
//   - Fraud scores / per-proof reasons NEVER leak to the user. Only the
//     count of passed/needed shows up in the user-facing message.
//   - One proof per `proofType` per request, enforced at the schema
//     layer (unique index). The builder de-dupes by type defensively too.

import { ProofStatus, ProofType, FraudStatus } from "@prisma/client";
import type { ScreenResult } from "@/lib/verification-fraud";

export const AUTO_APPROVE_THRESHOLD = 3;

/**
 * Single user-facing copy line. Surfaced in the verification page header
 * and (eventually) inline as the auto-approval CTA. Exported as a
 * constant so every consumer renders the same exact wording.
 */
export const MULTI_PROOF_USER_MESSAGE =
  "Submit at least 3 valid proofs for faster automatic verification.";

/**
 * Shape of a proof row we'll persist. Matches the VerificationProof
 * model 1:1 minus the bookkeeping fields (id, createdAt, requestId).
 */
export interface ProofInput {
  proofType: ProofType;
  status: ProofStatus;
  fraudStatus: FraudStatus | null;
  fraudScore: number | null;
  checkedAt: Date;
}

/**
 * Input narrowing — only the verification-form fields that map to a
 * proof type. Loose so the same builder can serve future forms that
 * carry additional URL fields without churning this signature.
 */
export interface BuildProofsInput {
  eduEmail: string | null;
  schoolEmailVerified: boolean;
  rosterUrl: string | null;
  rosterScreenshotUrl: string | null;
  studentIdUrl: string | null;
  proofUrl: string | null;
  recruitingProfileUrl: string | null;
  schoolDirectoryUrl: string | null;
  linkedinUrl: string | null;
  hudlUrl: string | null;
  isParentRequest: boolean;
  /** User has an active paid subscription (gates PAYMENT_VERIFICATION). */
  paymentVerified: boolean;
  /** User already has at least one APPROVED athlete or student connection. */
  hasPriorApprovedConnection: boolean;
  /**
   * Fraud results keyed by the URL string. Provided by the request
   * handler after calling screenMultiple(). Null entries mean "URL was
   * not screened" (non-image references such as LinkedIn).
   */
  fraudByUrl: Map<string, ScreenResult>;
}

/**
 * Compute the deterministic list of proof rows for a submission. Pure
 * function — easy to unit-test, no I/O.
 */
export function buildProofsForRequest(input: BuildProofsInput): ProofInput[] {
  const now = new Date();
  const proofs: ProofInput[] = [];

  // --- Image-backed proofs --------------------------------------------------
  // For each image URL the user provided, derive a proof row using the
  // matching fraud result (if any). A URL with no fraud result is treated
  // as PENDING — we shouldn't have that in practice, but we want a
  // predictable default rather than silently dropping the proof.

  pushImageBacked(proofs, ProofType.STUDENT_ID, input.studentIdUrl, input.fraudByUrl, now);

  // ROSTER_PAGE collapses two fields (rosterUrl + rosterScreenshotUrl)
  // into one proof type — both refer to the same conceptual evidence.
  // We take the WORST fraud result of the two so a user can't bypass a
  // flagged screenshot by also providing a link.
  pushRosterPage(proofs, input, now);

  // PARENT_GUARDIAN_DOC and GENERAL_PROOF are mutually exclusive — the
  // same `proofUrl` field plays different roles depending on whether
  // the request is a parent flow.
  if (input.isParentRequest) {
    pushImageBacked(proofs, ProofType.PARENT_GUARDIAN_DOC, input.proofUrl, input.fraudByUrl, now);
  } else {
    pushImageBacked(proofs, ProofType.GENERAL_PROOF, input.proofUrl, input.fraudByUrl, now);
  }

  // --- Link-only proofs ----------------------------------------------------
  // These aren't image uploads — we treat presence as PASSED. The
  // "is the URL a valid official source" check is handled separately by
  // the existing verification scorer (src/lib/verification-confidence.ts);
  // here we only care about the binary "did the user supply it".

  pushLinkOnly(proofs, ProofType.ATHLETICS_PROFILE, input.recruitingProfileUrl, now);
  pushLinkOnly(proofs, ProofType.ENROLLMENT_PORTAL, input.schoolDirectoryUrl, now);
  pushLinkOnly(proofs, ProofType.LINKEDIN, input.linkedinUrl, now);
  pushLinkOnly(proofs, ProofType.HUDL, input.hudlUrl, now);

  // --- Boolean / state-derived proofs --------------------------------------
  // School email is PASSED only when the .edu code round-trip completed.
  // Just having an email string isn't proof of access.
  if (input.eduEmail && input.schoolEmailVerified) {
    proofs.push({
      proofType: ProofType.SCHOOL_EMAIL,
      status: ProofStatus.PASSED,
      fraudStatus: null,
      fraudScore: null,
      checkedAt: now,
    });
  }
  if (input.paymentVerified) {
    proofs.push({
      proofType: ProofType.PAYMENT_VERIFICATION,
      status: ProofStatus.PASSED,
      fraudStatus: null,
      fraudScore: null,
      checkedAt: now,
    });
  }
  if (input.hasPriorApprovedConnection) {
    proofs.push({
      proofType: ProofType.PRIOR_APPROVED_CONNECTION,
      status: ProofStatus.PASSED,
      fraudStatus: null,
      fraudScore: null,
      checkedAt: now,
    });
  }

  // Defensive dedupe — the unique index on (requestId, proofType) would
  // throw at the DB layer anyway, but failing loud here gives a cleaner
  // stack and avoids a partial-write recovery problem.
  return uniqueByType(proofs);
}

/**
 * Count proofs with status === PASSED. Pure helper, exported for the
 * admin UI / scoring badge.
 */
export function countPassed(proofs: { status: ProofStatus }[]): number {
  return proofs.filter((p) => p.status === ProofStatus.PASSED).length;
}

/**
 * Eligibility for the multi-proof auto-approval path.
 *
 * Conditions:
 *   1. >= AUTO_APPROVE_THRESHOLD proofs at PASSED
 *   2. No proof in REVIEW_REQUIRED (fraud-flagged uploads disqualify
 *      regardless of how many other proofs pass — the brief calls this
 *      out as a hard rule)
 *
 * A FAILED proof does NOT disqualify on its own — failure of one piece
 * of evidence doesn't override three others passing — but it doesn't
 * count toward the threshold either.
 */
export function shouldAutoApprove(
  proofs: { status: ProofStatus }[]
): boolean {
  if (proofs.some((p) => p.status === ProofStatus.REVIEW_REQUIRED)) {
    return false;
  }
  return countPassed(proofs) >= AUTO_APPROVE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function pushImageBacked(
  acc: ProofInput[],
  proofType: ProofType,
  url: string | null,
  fraudByUrl: Map<string, ScreenResult>,
  now: Date
): void {
  if (!url || !url.trim()) return;
  const fr = fraudByUrl.get(url);
  if (!fr) {
    // No fraud result for an image-backed field is unexpected — surface
    // it as PENDING so admins know to look at it rather than treat the
    // proof as a free pass.
    acc.push({
      proofType,
      status: ProofStatus.PENDING,
      fraudStatus: null,
      fraudScore: null,
      checkedAt: now,
    });
    return;
  }
  acc.push({
    proofType,
    status: statusFromFraud(fr.status),
    fraudStatus: fr.status,
    fraudScore: fr.score,
    checkedAt: now,
  });
}

function pushRosterPage(
  acc: ProofInput[],
  input: BuildProofsInput,
  now: Date
): void {
  const urls = [input.rosterUrl, input.rosterScreenshotUrl].filter(
    (u): u is string => !!u && !!u.trim()
  );
  if (urls.length === 0) return;
  // Pick the worst fraud result across both fields. statusRank ordering:
  // DENIED > REVIEW_REQUIRED > CLEAR > absent.
  let worst: ScreenResult | null = null;
  for (const u of urls) {
    const fr = input.fraudByUrl.get(u);
    if (!fr) continue;
    if (!worst || fr.score > worst.score) worst = fr;
  }
  if (!worst) {
    acc.push({
      proofType: ProofType.ROSTER_PAGE,
      status: ProofStatus.PENDING,
      fraudStatus: null,
      fraudScore: null,
      checkedAt: now,
    });
    return;
  }
  acc.push({
    proofType: ProofType.ROSTER_PAGE,
    status: statusFromFraud(worst.status),
    fraudStatus: worst.status,
    fraudScore: worst.score,
    checkedAt: now,
  });
}

function pushLinkOnly(
  acc: ProofInput[],
  proofType: ProofType,
  url: string | null,
  now: Date
): void {
  if (!url || !url.trim()) return;
  acc.push({
    proofType,
    status: ProofStatus.PASSED,
    fraudStatus: null,
    fraudScore: null,
    checkedAt: now,
  });
}

function statusFromFraud(s: FraudStatus): ProofStatus {
  if (s === FraudStatus.CLEAR) return ProofStatus.PASSED;
  if (s === FraudStatus.REVIEW_REQUIRED) return ProofStatus.REVIEW_REQUIRED;
  // DENIED can't reach here in practice — the request handler short-
  // circuits with a 422 before building proofs — but if it does, we
  // mark FAILED instead of falsely counting as PASSED.
  return ProofStatus.FAILED;
}

function uniqueByType(proofs: ProofInput[]): ProofInput[] {
  const seen = new Map<ProofType, ProofInput>();
  for (const p of proofs) {
    // Keep the WORST status if we somehow see the same type twice —
    // ordering: PENDING > REVIEW_REQUIRED > FAILED > PASSED.
    const existing = seen.get(p.proofType);
    if (!existing || severity(p.status) > severity(existing.status)) {
      seen.set(p.proofType, p);
    }
  }
  return Array.from(seen.values());
}

function severity(s: ProofStatus): number {
  // Higher = "ought to win the merge conflict on duplicate".
  switch (s) {
    case ProofStatus.PENDING: return 3;
    case ProofStatus.REVIEW_REQUIRED: return 2;
    case ProofStatus.FAILED: return 1;
    case ProofStatus.PASSED: return 0;
  }
}
