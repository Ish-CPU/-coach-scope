/**
 * Email provider abstraction.
 *
 * Today we ship a Resend implementation that talks to the Resend HTTP API
 * directly — no SDK dep, no extra package, no node-only imports. The shape
 * of `EmailProvider` matches what SendGrid / Postmark / Nodemailer would
 * each need, so swapping providers later is a one-file change.
 *
 * Required env vars:
 *   RESEND_API_KEY  — bearer token from resend.com/api-keys
 *   EMAIL_FROM      — verified sender, e.g. "University Verified <alerts@myuniversityverified.com>"
 *
 * Optional env vars:
 *   EMAIL_PROVIDER  — "resend" (default) | "noop". `noop` short-circuits
 *                     every send (useful in dev / CI) and just logs.
 *
 * If RESEND_API_KEY is missing the provider falls back to noop so dev
 * environments don't crash — every send just writes a console line.
 */

export interface EmailInput {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional plain-text fallback. Resend will derive one if omitted. */
  text?: string;
  /** Optional Reply-To, useful when the master wants user replies routed away. */
  replyTo?: string;
  /** Optional categorical tag — surfaces in Resend's dashboard. */
  tag?: string;
}

export interface EmailResult {
  ok: boolean;
  /** Provider message id when known. */
  id?: string;
  /** Human-readable error string when `ok === false`. */
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: EmailInput): Promise<EmailResult>;
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

const RESEND_ENDPOINT = "https://api.resend.com/emails";

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  constructor(private apiKey: string, private from: string) {}

  async send(input: EmailInput): Promise<EmailResult> {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: this.from,
          to: Array.isArray(input.to) ? input.to : [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: input.replyTo,
          tags: input.tag ? [{ name: "category", value: input.tag }] : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `Resend ${res.status}: ${body || res.statusText}` };
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: json.id };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "send failed",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Noop fallback
// ---------------------------------------------------------------------------

class NoopProvider implements EmailProvider {
  readonly name = "noop";
  async send(input: EmailInput): Promise<EmailResult> {
    // eslint-disable-next-line no-console
    console.warn(
      `[email:noop] would send "${input.subject}" to ${
        Array.isArray(input.to) ? input.to.join(", ") : input.to
      } (set RESEND_API_KEY + EMAIL_FROM to enable real sends)`
    );
    return { ok: true, id: "noop" };
  }
}

// ---------------------------------------------------------------------------
// Factory + module-level singleton
// ---------------------------------------------------------------------------

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const explicit = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (explicit === "noop") {
    cached = new NoopProvider();
    return cached;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    cached = new NoopProvider();
    return cached;
  }
  cached = new ResendProvider(apiKey, from);
  return cached;
}

/**
 * Test-only: clear the cached provider so a unit/integration test can swap
 * env vars between cases. Production code should never call this.
 */
export function _resetEmailProviderForTests(): void {
  cached = null;
}
