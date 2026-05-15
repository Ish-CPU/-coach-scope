/**
 * Auto-confidence scoring for verification requests.
 *
 * Purpose: let admins approve obviously-real athletes/students quickly while
 * making suspicious submissions stand out. No AI image detection — just
 * cheap, deterministic checks against the structured proof fields the user
 * already submitted.
 *
 * The scorer runs at submit time and persists:
 *   - `confidenceScore` (0–100)
 *   - `status` (HIGH_CONFIDENCE / NEEDS_REVIEW / LOW_CONFIDENCE)
 *
 * Each check returns a `Signal`. The admin scorecard renders the same
 * signals as a checklist so the human reviewer sees exactly which checks
 * passed/failed.
 */
import { VerificationRequestStatus, VerificationMethod } from "@prisma/client";
import { rosterUrlLooksOfficial } from "@/lib/verification";

export interface ScoringInput {
  method: VerificationMethod;
  /** The user's account display name. Compared against URL hosts/paths. */
  userName?: string | null;
  /** Universities name as the user typed it on the form. */
  universityName?: string | null;
  /** Sport as the user typed it on the form. */
  sport?: string | null;
  rosterUrl?: string | null;
  proofUrl?: string | null;
  studentIdUrl?: string | null;
  rosterScreenshotUrl?: string | null;
  linkedinUrl?: string | null;
  hudlUrl?: string | null;
  recruitingProfileUrl?: string | null;
  schoolDirectoryUrl?: string | null;
  eduEmail?: string | null;
  schoolEmailVerified?: boolean;
}

export type SignalKey =
  | "nameInRosterUrl"
  | "schoolInRosterDomain"
  | "rosterUrlOfficial"
  | "studentIdUploaded"
  | "rosterScreenshotUploaded"
  | "schoolEmailVerified"
  | "externalProfilesPresent"
  | "noObviousMismatch";

export interface Signal {
  key: SignalKey;
  label: string;
  /** true=passed, false=failed, null=not applicable / not enough info to tell. */
  ok: boolean | null;
  /** Short human-readable detail surfaced in the admin scorecard. */
  detail?: string;
}

export interface ScoringResult {
  score: number;                    // 0–100
  status: VerificationRequestStatus; // HIGH_CONFIDENCE / NEEDS_REVIEW / LOW_CONFIDENCE
  signals: Signal[];
}

// Weight per signal. Tuned so a "roster URL on official domain that contains
// the user's name" cracks the HIGH_CONFIDENCE bar on its own; a manual ID
// upload alone never does.
const WEIGHTS: Record<SignalKey, number> = {
  nameInRosterUrl: 30,
  schoolInRosterDomain: 25,
  rosterUrlOfficial: 15,
  studentIdUploaded: 10,
  rosterScreenshotUploaded: 5,
  schoolEmailVerified: 20,
  externalProfilesPresent: 5,
  noObviousMismatch: 0, // tri-state: if false, large negative — handled below
};

/** Penalty applied when an obvious mismatch is detected. */
const MISMATCH_PENALTY = 40;

const HIGH_THRESHOLD = 60;
const LOW_THRESHOLD = 25;

export function scoreVerification(input: ScoringInput): ScoringResult {
  const signals: Signal[] = [];

  // --- Normalize inputs once -------------------------------------------------
  const name = (input.userName ?? "").trim().toLowerCase();
  const school = (input.universityName ?? "").trim().toLowerCase();
  const sport = (input.sport ?? "").trim().toLowerCase();
  const nameTokens = name
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  const schoolTokens = school
    .replace(/^the /i, "")
    .replace(/university of /i, "")
    .replace(/state university/i, "state")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !["of", "and", "the"].includes(t));

  let rosterUrlHost = "";
  let rosterUrlPath = "";
  if (input.rosterUrl) {
    try {
      const u = new URL(input.rosterUrl);
      rosterUrlHost = u.hostname.toLowerCase();
      rosterUrlPath = (u.pathname + u.search).toLowerCase();
    } catch {
      // bad URL — treat as no roster URL
    }
  }

  // --- Roster URL signals ----------------------------------------------------
  if (input.rosterUrl) {
    const official = rosterUrlLooksOfficial(input.rosterUrl);
    signals.push({
      key: "rosterUrlOfficial",
      label: "Official roster / profile URL",
      ok: official,
      detail: official
        ? `${rosterUrlHost} looks like an official athletics/edu domain.`
        : "URL is not on an official .edu / athletics domain.",
    });

    const nameHit =
      nameTokens.length > 0 &&
      nameTokens.every((t) => rosterUrlPath.includes(t));
    signals.push({
      key: "nameInRosterUrl",
      label: "Name appears in roster URL",
      ok: nameTokens.length > 0 ? nameHit : null,
      detail: nameHit
        ? "All name tokens are present in the roster URL path."
        : nameTokens.length === 0
        ? "No account name to match against."
        : "Roster URL does not contain the user's full name.",
    });

    const schoolHit =
      schoolTokens.length > 0 &&
      schoolTokens.some((t) => rosterUrlHost.includes(t));
    signals.push({
      key: "schoolInRosterDomain",
      label: "School appears in roster URL domain",
      ok: schoolTokens.length > 0 ? schoolHit : null,
      detail: schoolHit
        ? `Domain ${rosterUrlHost} mentions "${schoolTokens.find((t) => rosterUrlHost.includes(t))}".`
        : schoolTokens.length === 0
        ? "No university name to match against."
        : `Domain ${rosterUrlHost} does not mention the submitted school.`,
    });
  } else {
    // No roster URL at all — surface these as failed so the admin sees
    // the gap rather than a hidden signal.
    signals.push({ key: "rosterUrlOfficial", label: "Official roster / profile URL", ok: false, detail: "No roster URL submitted." });
    signals.push({ key: "nameInRosterUrl", label: "Name appears in roster URL", ok: false, detail: "No roster URL to check." });
    signals.push({ key: "schoolInRosterDomain", label: "School appears in roster URL domain", ok: false, detail: "No roster URL to check." });
  }

  // --- Uploads ---------------------------------------------------------------
  signals.push({
    key: "studentIdUploaded",
    label: "Student ID / alumni doc uploaded",
    ok: !!input.studentIdUrl,
    detail: input.studentIdUrl
      ? "Image link present (supporting evidence only)."
      : "No student ID upload.",
  });

  signals.push({
    key: "rosterScreenshotUploaded",
    label: "Roster screenshot uploaded",
    ok: input.rosterScreenshotUrl ? true : null,
    detail: input.rosterScreenshotUrl
      ? "Supporting screenshot present."
      : "No screenshot — optional.",
  });

  // --- School email ----------------------------------------------------------
  signals.push({
    key: "schoolEmailVerified",
    label: "School email verified (.edu)",
    ok: input.schoolEmailVerified
      ? true
      : input.method === VerificationMethod.EDU_EMAIL && input.eduEmail
      ? null
      : false,
    detail: input.schoolEmailVerified
      ? `Verified ${input.eduEmail ?? "school email"}.`
      : input.eduEmail
      ? "Code flow not yet confirmed."
      : "No school email submitted.",
  });

  // --- External profiles -----------------------------------------------------
  const externalCount = [
    input.linkedinUrl,
    input.hudlUrl,
    input.recruitingProfileUrl,
    input.schoolDirectoryUrl,
  ].filter(Boolean).length;
  signals.push({
    key: "externalProfilesPresent",
    label: "External profile links",
    ok: externalCount > 0 ? true : null,
    detail:
      externalCount > 0
        ? `${externalCount} external profile link${externalCount === 1 ? "" : "s"} submitted.`
        : "No external profile links submitted (optional).",
  });

  // --- Mismatch detection ----------------------------------------------------
  // We flag a hard mismatch when the user supplied BOTH a roster URL AND a
  // university name AND the URL host clearly mentions a different school
  // (we have at least one school token to match and none of them are in
  // the host). Same for the .edu email: if the email's domain doesn't
  // contain ANY school-name token, flag.
  let mismatch = false;
  let mismatchDetail = "";
  if (input.rosterUrl && schoolTokens.length > 0 && rosterUrlHost && !schoolTokens.some((t) => rosterUrlHost.includes(t))) {
    mismatch = true;
    mismatchDetail = `Roster URL host (${rosterUrlHost}) doesn't match submitted school.`;
  }
  if (
    !mismatch &&
    input.eduEmail &&
    schoolTokens.length > 0 &&
    !schoolTokens.some((t) => input.eduEmail!.toLowerCase().includes(t))
  ) {
    mismatch = true;
    mismatchDetail = `.edu email (${input.eduEmail}) doesn't match submitted school.`;
  }
  signals.push({
    key: "noObviousMismatch",
    label: "No obvious school / name mismatch",
    ok: !mismatch,
    detail: mismatch ? mismatchDetail : "No obvious mismatch detected.",
  });

  // --- Score -----------------------------------------------------------------
  let score = 0;
  for (const s of signals) {
    if (s.key === "noObviousMismatch") {
      if (s.ok === false) score -= MISMATCH_PENALTY;
      continue;
    }
    if (s.ok === true) score += WEIGHTS[s.key];
  }
  score = Math.max(0, Math.min(100, score));

  let status: VerificationRequestStatus;
  if (mismatch || score < LOW_THRESHOLD) status = VerificationRequestStatus.LOW_CONFIDENCE;
  else if (score >= HIGH_THRESHOLD) status = VerificationRequestStatus.HIGH_CONFIDENCE;
  else status = VerificationRequestStatus.NEEDS_REVIEW;

  return { score, status, signals };
}
