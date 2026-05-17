# University Verified — Security model

This document describes the security posture of the app, what's implemented in code, and what still depends on **operator** discipline (env vars, hosting, monitoring).

---

## 1. Authentication

| Concern | Implementation |
|---|---|
| Password storage | `bcryptjs` with cost `12` ([`src/lib/security.ts`](src/lib/security.ts)). Plaintext passwords are never persisted or logged. |
| Session storage | NextAuth JWT sessions, signed with `NEXTAUTH_SECRET`. Cookies are HttpOnly + SameSite=Lax (NextAuth defaults). |
| Session contents | Only `id, role, paymentVerified, subscriptionStatus, verificationStatus`. No email or PII inside the JWT body beyond the standard NextAuth claims. |
| Sign-in throttling | Per-IP (10 / 5 min) **and** per-email (5 / 5 min) rate limits inside the credentials `authorize()` ([`src/lib/auth.ts`](src/lib/auth.ts)). Both use the same in-memory limiter. |
| Failure responses | Wrong password and rate-limited responses both return NextAuth's null path → identical client-side message. We do not leak which case applied. |
| Open-redirect on sign-in | `?callbackUrl=` is sanitized through `safeCallbackUrl` ([`src/lib/safe-url.ts`](src/lib/safe-url.ts)) — only same-origin relative paths pass; absolute URLs, protocol-relative URLs, control characters, and backslashes fall back to `/dashboard`. |

---

## 2. Authorization

Every state-changing endpoint goes through one of two gates in [`src/lib/permissions.ts`](src/lib/permissions.ts):

- `whyCannotParticipate(session)` → returns the reason or `null`. Used for reviews, posts, comments, votes, favorites, group create, etc.
- `isAdmin(session)` → required for every `/api/admin/*` handler.

**Defense in depth on the admin surface**: the Next.js middleware ([`src/middleware.ts`](src/middleware.ts)) also gates both `/admin/:path*` (pages) **and** `/api/admin/:path*` (APIs). Unauthenticated requests to admin APIs return `401`; non-admin tokens get `403`. The handlers also re-check, so a misconfigured matcher doesn't expose anything.

Per-action role gates live alongside `whyCannotParticipate`:

- `canRateCoaches` — `VERIFIED_ATHLETE` only.
- `canRateUniversitiesAndDorms` — Athlete or Student.
- `canSubmitParentInsight` — `VERIFIED_PARENT` only.
- `canParticipateInGroup(session, groupType)` — audience must match the group.

---

## 3. Rate limiting

In-memory sliding-window limiter ([`src/lib/rate-limit.ts`](src/lib/rate-limit.ts)). Identifier = authenticated user ID where available, else `x-forwarded-for` IP.

| Route | Limit |
|---|---|
| `POST /api/auth/register` | 5 / 5 min per IP |
| NextAuth `signIn` (credentials) | 10 / 5 min per IP **and** 5 / 5 min per email |
| `POST /api/verification` | 10 / 10 min per user *(plus the 24h attempt cap)* |
| `POST /api/verification/code/request` | 5 / 15 min per user **and** 20 / hour per IP |
| `POST /api/verification/code/confirm` | 10 / 15 min per user **and** 30 / 15 min per IP |
| `POST /api/reviews` | 10 / 10 min per user |
| `POST /api/reviews/[id]/helpful` | 60 / min per user |
| `POST /api/reviews/[id]/report` | 20 / 10 min per user |
| `POST /api/favorites` | 60 / min per user |
| `POST /api/groups` | 5 / hour per user |
| `POST /api/groups/[slug]/posts` | 10 / 10 min per user |
| `POST /api/posts/[id]/comments` | 30 / 10 min per user |
| `POST /api/posts/[id]/vote` | 120 / min per user |
| `POST /api/stripe/checkout` | 10 / hour per user |
| `POST /api/stripe/portal` | 10 / hour per user |

> **Caveat — single-process counters.** On Vercel's serverless, each instance has its own bucket. This stops casual bots and accidental loops; it will not stop a coordinated distributed attack. For that, swap the in-memory store in `rate-limit.ts` for Upstash Redis or a similar shared store. The interface is small enough to swap in one file.

The Stripe webhook is **deliberately unrated** — it's signature-verified, can come from many Stripe IPs, and any rate limit would create a deliverability incident.

---

## 4. Input validation

- All write endpoints parse the request body with `zod` ([`src/lib/review-schemas.ts`](src/lib/review-schemas.ts), inline `z.object({...})` in handlers).
- String length caps everywhere (review title 140, body 5000, comment 5000, post body 10000, name 80, email 254).
- Sport/division values for the public-data importer are validated against canonical lists ([`src/lib/sports.ts`](src/lib/sports.ts), `normalizeDivision`).
- Free-text URLs go through `isSafeHttpUrl` ([`src/lib/safe-url.ts`](src/lib/safe-url.ts)) which:
  - rejects non-`http(s)` schemes (`javascript:`, `data:`, `file:`, `vbscript:`)
  - rejects link shorteners and Google Drive (bit.ly, drive.google.com, tinyurl.com, t.co)

---

## 5. Verification data — privacy posture

The most sensitive PII in the system lives on `VerificationRequest`:

- Athlete `eduEmail`, `rosterUrl`, optional `proofUrl`, optional `notes`.
- Parent `eduEmail` / `proofUrl` / `notes`.

How it's protected:

- **Public surface** is only the `User.role` enum + the anonymous display name ("Anonymous Verified Athlete" — see [`src/lib/anonymous.ts`](src/lib/anonymous.ts)). The user's real name and email are never returned by any public review / post / comment API.
- **Admin-only access** to verification rows: `/admin/verifications` (page) and `/api/admin/verifications/[id]` (mutate) both check `isAdmin`, plus the middleware double-checks for `/api/admin/*`.
- **Code storage**: 6-digit codes are bcrypt-hashed before persisting (`hashCode`, [`src/lib/verification.ts`](src/lib/verification.ts)). The plaintext code is sent only to the verified email; in production we log only metadata, never the code itself.
- **Attempt logging**: every code mismatch + every submission creates a `VerificationRequest` row with `attemptNumber`, used to enforce the 24-hour cap (5 attempts/user) and to give admins a per-user audit trail.
- **Manual proof uploads** are never auto-approved — admin review is required, and the proof URL is validated to be a safe `http(s)` link, not a shortener or Drive link.
- **Recommended retention policy** (operator action): purge `VerificationRequest` rows in status `VERIFIED` or `REJECTED` after N days (e.g. 90). This is policy, not code — set up a cron via `npx prisma studio` or a small SQL job to keep PII out of cold storage.

---

## 6. Stripe + payments

- **Card data never touches University Verified.** All payment collection happens inside Stripe Checkout (hosted) and the Billing Portal (hosted). We only store `stripeCustomerId` and `stripeSubscriptionId`.
- Checkout API requires both an authenticated user **and** a server-side `requireEnv("STRIPE_SECRET_KEY")` check. In a misconfigured deploy the route returns `500` with a clear message instead of silently succeeding with a placeholder key.
- The webhook strictly verifies the Stripe signature ([`src/app/api/stripe/webhook/route.ts`](src/app/api/stripe/webhook/route.ts)). On failure it returns a generic `400` without echoing details that would help an attacker probe.
- `success_url` and `cancel_url` are constructed server-side from `appUrl()` ([`src/lib/env.ts`](src/lib/env.ts)) — the client cannot influence them.
- Customer portal `return_url` is also server-constructed.

---

## 7. Environment variables

- `requireEnv()` / `optionalEnv()` / `appUrl()` / `assertAuthSecretConfigured()` are in [`src/lib/env.ts`](src/lib/env.ts). Build-time imports never throw; secrets are only required at the call site that needs them.
- `NEXTAUTH_SECRET` must be set in production. The middleware will silently fail to issue session cookies otherwise — call `assertAuthSecretConfigured()` from a startup hook if you want a hard fail.
- `NEXT_PUBLIC_*` vars are the only ones exposed to the browser. Audit before adding new ones — anything `NEXT_PUBLIC_*` ends up in the client bundle.
- The Stripe SDK initializer in [`src/lib/stripe.ts`](src/lib/stripe.ts) keeps a `"sk_test_placeholder"` fallback so `prisma generate` and `next build` work without secrets — **runtime** routes call `requireEnv("STRIPE_SECRET_KEY")` to fail loudly if the placeholder leaks into production.

---

## 8. Browser-level protections

Set in [`next.config.js`](next.config.js) `headers()`:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — 2-year HSTS so browsers refuse to downgrade to HTTP.
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing of CSS / JS.
- `X-Frame-Options: DENY` — blocks clickjacking via iframe.
- `Referrer-Policy: strict-origin-when-cross-origin` — never sends full URL paths to third parties.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()` — disables features we never use; also opts out of FLoC.

NextAuth issues HttpOnly + SameSite=Lax cookies, which is University Verified's primary CSRF defense. Custom write endpoints accept JSON only — no form-encoded POSTs that browsers would auto-submit cross-origin.

---

## 9. What's still on the operator

Pure code can't cover these — they're checklist items for the deploy:

1. Run on HTTPS only. Configure your domain with HSTS (the header is already there; preload listing is your call).
2. Set every required env var (see [`.env.example`](.env.example)). Do **not** check `.env` into git (it's already in `.gitignore`).
3. In Stripe → **only** generate webhook secrets in the dashboard, copy them into `STRIPE_WEBHOOK_SECRET`. Never reuse a webhook secret across environments.
4. Rotate `NEXTAUTH_SECRET` if you suspect compromise — this invalidates every session.
5. Move the rate limiter to a shared store (Upstash, Redis) when traffic warrants it.
6. Wire `sendVerificationEmail()` in [`src/lib/verification.ts`](src/lib/verification.ts) to a real email provider (Resend / SendGrid / Postmark) for production.
7. Set up a retention job for `VerificationRequest` rows older than your policy window.
8. Review `npm audit` regularly. The repo currently shows transitive vulnerabilities through `next` / `bcryptjs`; upgrade with `npm i next@latest @prisma/client@latest` when you bump.
9. Database backups + point-in-time recovery — University Verified's data lives in your Postgres, not in the app.

---

## 10. Reporting a vulnerability

Please email `security@myuniversityverified.com` (or open a private GitHub security advisory) with reproduction steps. Do not file public issues for security bugs.
