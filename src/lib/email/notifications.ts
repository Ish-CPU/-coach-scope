/**
 * High-level send helpers for every admin-facing notification event.
 *
 * Every helper is fire-and-forget safe — they never throw, never block
 * the originating user-facing request, and always log success/failure to
 * the audit log. Call them with `void sendXyzEmail(...)` from the API
 * route after the row has been persisted.
 *
 * Templates are intentionally stripped of sensitive evidence (proof URLs,
 * student IDs, etc.). The body always points back to the secure admin
 * portal where authenticated review is required.
 */
import { getEmailProvider, type EmailInput } from "./provider";
import {
  getAdminNotificationRecipients,
  type NotificationCategory,
} from "./recipients";
import {
  publicBaseUrl,
  renderEmailLayout,
  renderEmailText,
  type ActionLink,
  type EmailLayoutInput,
} from "./templates";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";

// ---------------------------------------------------------------------------
// Internal: send + log
// ---------------------------------------------------------------------------

interface SendArgs {
  category: NotificationCategory;
  subject: string;
  layout: EmailLayoutInput;
  /** Used as the audit log `targetType` so admins can correlate to source rows. */
  targetType?: string;
  targetId?: string;
  /** Optional override; defaults to all admin recipients for the category. */
  to?: string[];
  /** Optional Reply-To. */
  replyTo?: string;
  /** Provider-side category tag for analytics. */
  tag?: string;
}

async function send(args: SendArgs): Promise<void> {
  const recipients =
    args.to && args.to.length > 0
      ? args.to
      : await getAdminNotificationRecipients(args.category);

  if (recipients.length === 0) {
    // Nothing to do — but log it so we know an event fired with no audience.
    // eslint-disable-next-line no-console
    console.warn(`[email] no recipients for "${args.subject}" (${args.category})`);
    return;
  }

  const provider = getEmailProvider();
  const input: EmailInput = {
    to: recipients,
    subject: args.subject,
    html: renderEmailLayout(args.layout),
    text: renderEmailText(args.layout),
    replyTo: args.replyTo,
    tag: args.tag ?? args.category,
  };

  const result = await provider.send(input);

  // Audit every send (success or fail). `actorUserId` is intentionally
  // null — these emails are system-driven, not initiated by a specific admin.
  await logAdminAction({
    actorUserId: null,
    action: result.ok ? AUDIT_ACTIONS.EMAIL_SENT : AUDIT_ACTIONS.EMAIL_FAILED,
    targetType: args.targetType,
    targetId: args.targetId,
    metadata: {
      provider: provider.name,
      category: args.category,
      subject: args.subject,
      recipients,
      messageId: result.id ?? null,
      error: result.error ?? null,
    },
  }).catch((err) => {
    // Audit must never break the send. Log to console as last resort.
    // eslint-disable-next-line no-console
    console.error("[email] audit log write failed", err);
  });

  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[email] FAILED via ${provider.name}: "${args.subject}" → ${recipients.join(
        ", "
      )} :: ${result.error}`
    );
  }
}

// ---------------------------------------------------------------------------
// Verification submissions
// ---------------------------------------------------------------------------

export interface VerificationEmailInput {
  requestId: string;
  userName: string | null;
  userEmail: string | null;
  targetRole: string;
  university?: string | null;
  sport?: string | null;
}

export function sendVerificationRequestEmail(
  input: VerificationEmailInput
): Promise<void> {
  const base = publicBaseUrl();
  const reviewUrl = `${base}/admin/verifications`;
  const meta: { label: string; value: string }[] = [
    { label: "User", value: input.userName || "—" },
    { label: "Email", value: input.userEmail || "—" },
    { label: "Requested role", value: humanizeRole(input.targetRole) },
  ];
  if (input.university) meta.push({ label: "University", value: input.university });
  if (input.sport) meta.push({ label: "Sport / program", value: input.sport });

  return send({
    category: "verifications",
    subject: `New ${humanizeRole(input.targetRole)} verification`,
    targetType: "VerificationRequest",
    targetId: input.requestId,
    layout: {
      title: `New ${humanizeRole(input.targetRole)} verification`,
      preheader: `${input.userName ?? input.userEmail ?? "A user"} submitted verification.`,
      intro:
        "A user submitted a verification request. Confidence score, evidence, and approve / reject controls are inside the portal.",
      meta,
      actions: [
        { label: "Review Request", href: reviewUrl, variant: "primary" },
        { label: "Open Admin Dashboard", href: `${base}/admin/dashboard` },
      ],
      footnote:
        "Identity proofs are intentionally not included in this email. Review them only after signing in.",
    },
  });
}

// ---------------------------------------------------------------------------
// Connection submissions (athlete + student)
// ---------------------------------------------------------------------------

export interface ConnectionEmailInput {
  kind: "athlete" | "student";
  connectionId: string;
  userName: string | null;
  userEmail: string | null;
  university: string;
  /** Athlete only — sport / program name. */
  sport?: string | null;
  connectionType: string;
}

export function sendConnectionRequestEmail(
  input: ConnectionEmailInput
): Promise<void> {
  const base = publicBaseUrl();
  const reviewUrl = `${base}/admin/connections?kind=${input.kind}`;
  const meta = [
    { label: "User", value: input.userName || "—" },
    { label: "Email", value: input.userEmail || "—" },
    { label: "University", value: input.university },
  ];
  if (input.sport) meta.push({ label: "Sport / program", value: input.sport });
  meta.push({
    label: "Connection type",
    value: humanizeEnum(input.connectionType),
  });

  return send({
    category: "connections",
    subject: `New ${input.kind} connection submitted`,
    targetType:
      input.kind === "athlete"
        ? "AthleteProgramConnection"
        : "StudentUniversityConnection",
    targetId: input.connectionId,
    layout: {
      title: `New ${input.kind} connection`,
      preheader: `${input.userName ?? input.userEmail ?? "A user"} requested ${input.university}.`,
      intro:
        "A user submitted a connection. Approving it unlocks the matching review permissions for that program / school.",
      meta,
      actions: [
        { label: "Review Request", href: reviewUrl, variant: "primary" },
        { label: "Open Admin Dashboard", href: `${base}/admin/dashboard` },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Moderation alerts (review reports + group reports)
// ---------------------------------------------------------------------------

export interface ModerationAlertInput {
  /** What was reported. */
  target: "review" | "group_post" | "group_comment";
  targetId: string;
  reportId: string;
  reason: string;
  /** Total open reports against the same target after this submission. */
  totalReports?: number;
  reporterName: string | null;
  reporterEmail: string | null;
  /** Set true if `totalReports` crossed the auto-moderation threshold. */
  thresholdExceeded?: boolean;
}

export function sendModerationAlertEmail(
  input: ModerationAlertInput
): Promise<void> {
  const base = publicBaseUrl();
  const reviewUrl = `${base}/admin/reports`;
  const targetLabel =
    input.target === "review"
      ? "Review"
      : input.target === "group_post"
      ? "Group post"
      : "Group comment";

  const meta = [
    { label: "Target", value: `${targetLabel} ${input.targetId}` },
    { label: "Reason", value: input.reason },
    { label: "Reporter", value: input.reporterName || "—" },
    { label: "Reporter email", value: input.reporterEmail || "—" },
  ];
  if (typeof input.totalReports === "number") {
    meta.push({
      label: "Total open reports",
      value: String(input.totalReports),
    });
  }

  return send({
    category: "reports",
    subject: input.thresholdExceeded
      ? `⚠ ${targetLabel} crossed report threshold`
      : `New ${targetLabel.toLowerCase()} report`,
    targetType: input.target,
    targetId: input.targetId,
    layout: {
      title: input.thresholdExceeded
        ? `${targetLabel} crossed the report threshold`
        : `New ${targetLabel.toLowerCase()} report`,
      preheader:
        input.thresholdExceeded
          ? `Auto-flag: open report count is now ${input.totalReports}.`
          : `${input.reporterName ?? input.reporterEmail ?? "Someone"} reported a ${targetLabel.toLowerCase()}.`,
      intro: input.thresholdExceeded
        ? "Multiple users have reported the same content. It hasn't been hidden automatically — please triage."
        : "A user reported content. Review the report and decide whether to hide / remove the content or dismiss.",
      meta,
      actions: [
        { label: "Review Request", href: reviewUrl, variant: "primary" },
        { label: "Open Admin Dashboard", href: `${base}/admin/dashboard` },
      ],
      footnote:
        "Report details (free-text) are visible only inside the portal to keep PII out of email.",
    },
  });
}

// ---------------------------------------------------------------------------
// Program / school requests
// ---------------------------------------------------------------------------

export interface ProgramRequestEmailInput {
  requestId: string;
  schoolName: string;
  sport: string;
  state?: string | null;
  division?: string | null;
  requesterRole?: string | null;
  requesterEmail?: string | null;
}

export function sendProgramRequestEmail(
  input: ProgramRequestEmailInput
): Promise<void> {
  const base = publicBaseUrl();
  const reviewUrl = `${base}/admin/requests`;
  const meta = [
    { label: "School", value: input.schoolName },
    { label: "Sport", value: input.sport },
  ];
  if (input.state) meta.push({ label: "State", value: input.state });
  if (input.division) meta.push({ label: "Division", value: input.division });
  if (input.requesterRole)
    meta.push({ label: "Requester role", value: input.requesterRole });
  if (input.requesterEmail)
    meta.push({ label: "Requester email", value: input.requesterEmail });

  return send({
    category: "program_requests",
    subject: `New program request: ${input.schoolName} (${input.sport})`,
    targetType: "ProgramRequest",
    targetId: input.requestId,
    layout: {
      title: `New program request`,
      preheader: `${input.schoolName} · ${input.sport}`,
      intro:
        "A user is asking us to add this school / program. Validate against official sources, then import or reject from the admin queue.",
      meta,
      actions: [
        { label: "Review Request", href: reviewUrl, variant: "primary" },
        { label: "Open Admin Dashboard", href: `${base}/admin/dashboard` },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Admin lifecycle (security category — master always gets these)
// ---------------------------------------------------------------------------

export type AdminLifecycleEvent =
  | "invited"
  | "activated"
  | "suspended"
  | "disabled"
  | "removed"
  | "force_logout"
  | "login_failure_threshold";

export interface AdminAlertInput {
  event: AdminLifecycleEvent;
  /** Subject of the action — the admin being changed (or attacked). */
  subjectName: string | null;
  subjectEmail: string;
  /** When known: the actor (master) who triggered the change. */
  actorName?: string | null;
  /** Optional reason / note. */
  reason?: string | null;
  /** For login_failure_threshold: how many attempts crossed the line. */
  attemptCount?: number;
}

const EVENT_LABEL: Record<AdminLifecycleEvent, string> = {
  invited: "New admin invited",
  activated: "Admin activated",
  suspended: "Admin suspended",
  disabled: "Admin disabled",
  removed: "Admin removed",
  force_logout: "Admin sessions force-logged-out",
  login_failure_threshold: "Failed admin login attempts crossed threshold",
};

export function sendAdminAlertEmail(input: AdminAlertInput): Promise<void> {
  const base = publicBaseUrl();
  const teamUrl = `${base}/admin/team`;
  const meta = [
    { label: "Account", value: input.subjectName || input.subjectEmail },
    { label: "Email", value: input.subjectEmail },
  ];
  if (input.actorName) meta.push({ label: "Changed by", value: input.actorName });
  if (input.reason) meta.push({ label: "Reason", value: input.reason });
  if (typeof input.attemptCount === "number")
    meta.push({ label: "Failed attempts", value: String(input.attemptCount) });

  const actions: ActionLink[] = [
    { label: "Open Admin Dashboard", href: `${base}/admin/dashboard`, variant: "primary" },
    { label: "View Team", href: teamUrl },
  ];

  return send({
    // Lifecycle and security alerts both go to the same category. Master
    // admins are always opted in regardless.
    category: input.event === "login_failure_threshold" ? "security" : "admin_lifecycle",
    subject: `[Admin] ${EVENT_LABEL[input.event]}: ${input.subjectEmail}`,
    targetType: "User",
    layout: {
      title: EVENT_LABEL[input.event],
      preheader: `Subject: ${input.subjectEmail}`,
      intro:
        input.event === "login_failure_threshold"
          ? "An email address has triggered the failed-sign-in threshold. Investigate before unlocking."
          : "Admin lifecycle change. Open the team page to review settings, permissions, and audit history.",
      meta,
      actions,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanizeEnum(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function humanizeRole(raw: string): string {
  return humanizeEnum(raw.replace(/^VERIFIED_/, ""));
}
