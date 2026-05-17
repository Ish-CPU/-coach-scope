# MyUniversityVerified — Production Deployment Checklist

Single source of truth for shipping this codebase to a real domain
(`myuniversityverified.com` by default). Pair this with `SECURITY.md`
(threat model) and `SETUP.md` (local dev).

---

## 1. Required environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, scope
each to **Production** (and Preview if you use preview deploys).

| Var                                   | Purpose                                                                 | Required |
| ------------------------------------- | ----------------------------------------------------------------------- | -------- |
| `DATABASE_URL`                        | Neon **pooled** URL (`-pooler` host, `?pgbouncer=true&connection_limit=1`) | ✓        |
| `DIRECT_URL`                          | Neon unpooled URL — only if you add `directUrl` to `prisma/schema.prisma` | optional |
| `NEXTAUTH_URL`                        | Canonical `https://...` of the production deploy                        | ✓        |
| `NEXTAUTH_SECRET`                     | `openssl rand -base64 32`                                               | ✓        |
| `STRIPE_SECRET_KEY`                   | Live `sk_live_...`                                                      | ✓        |
| `STRIPE_WEBHOOK_SECRET`               | From the live webhook endpoint created in Stripe                        | ✓        |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`  | Live `pk_live_...`                                                      | ✓        |
| `STRIPE_PRICE_MONTHLY_ID`             | Live price ID                                                           | ✓        |
| `STRIPE_PRICE_YEARLY_ID`              | Live price ID                                                           | ✓        |
| `NEXT_PUBLIC_APP_URL`                 | Same as `NEXTAUTH_URL` — used in emails + canonical URLs                | ✓        |
| `RESEND_API_KEY`                      | Outbound email; silently no-ops if unset                                | strongly recommended |
| `EMAIL_FROM`                          | e.g. `MyUniversityVerified <noreply@myuniversityverified.com>`           | with RESEND_API_KEY |
| `MASTER_ADMIN_EMAIL` / `MASTER_ADMIN_PASSWORD` | Only consulted by `npm run admin:create-master`. Unset on Vercel. | seed-only |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID`       | Placeholder (no current consumer)                                       | optional |

Boot-time check in `src/lib/env.ts` (`assertProductionEnv`) fails the first
request in production if any of the **✓** vars are missing — surfaces
misconfig immediately rather than per-feature.

---

## 2. Database (Neon)

1. **Pooled URL is non-negotiable on Vercel.** Each serverless instance
   opens its own Prisma client; without PgBouncer you hit
   `too many connections` under modest load. Append:
   ```
   ?sslmode=require&pgbouncer=true&connection_limit=1
   ```
2. **First-time schema:** `npx prisma db push` from your laptop with the
   **unpooled** URL temporarily exported as `DATABASE_URL`. The pooler
   doesn't support advisory locks that `db push` uses.
3. **For migrations going forward,** if you switch to `prisma migrate
   deploy`, wire `directUrl` in `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```
   and set `DIRECT_URL` to the unpooled URL on Vercel.
4. **Master admin:** after the schema is up, run
   ```
   MASTER_ADMIN_EMAIL=you@example.com MASTER_ADMIN_PASSWORD='...' npm run admin:create-master
   ```
   against the production DB **once**. Then unset the two env vars on Vercel.

---

## 3. Stripe

1. Create live products + prices in the Stripe dashboard. Copy the price
   IDs into `STRIPE_PRICE_MONTHLY_ID` / `STRIPE_PRICE_YEARLY_ID`.
2. Add a webhook endpoint pointing at `https://<your-domain>/api/stripe/webhook`.
   Subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. The handler 400s
   on missing signature and 500s on missing secret — both intentional.
4. After deploy: trigger one real checkout end-to-end, confirm the user's
   `role` flips to the selected verified tier and `subscriptionStatus`
   becomes `ACTIVE`.

---

## 4. Email (Resend)

1. Verify your sending domain in Resend.
2. Set `RESEND_API_KEY` + `EMAIL_FROM`. Without these, the email pipeline
   no-ops silently and only logs the intended recipient — admin queues
   and audit log still capture everything else.
3. Sanity-check by triggering a verification code (`/verification`) and
   confirming delivery.

---

## 5. Vercel setup

The committed `vercel.json` already pins:
- `framework: nextjs`
- `buildCommand: prisma generate && next build` (also matches `package.json`)
- `installCommand: npm ci`
- `regions: ["iad1"]` — change if Neon is in a different region
- per-route `maxDuration` for the slow paths (import, webhook, reviews,
  verification)

Manual Vercel steps:

1. Connect the GitHub repo in the Vercel dashboard.
2. **Build & Development Settings → Root Directory:** leave at default
   (repo root).
3. **Build & Development Settings → Node Version:** 20.x (matches local
   `@types/node ^20`).
4. **Environment Variables:** add the table above. Scope to Production
   (and Preview if you use it).
5. **Domains:** add `myuniversityverified.com` (or your domain) and set it as
   the primary. Vercel issues the TLS cert automatically.
6. **Deployment Protection:** if you want preview deploys gated, enable
   Vercel Authentication on Preview.

Note on cold starts: the in-memory rate limiter in `src/lib/rate-limit.ts`
is per-instance. That's enough to defeat trivial bots but not a
distributed attacker. If you need shared-state rate limiting, swap to
Upstash Redis — the API surface (`rateLimit`, `rateLimitCheck`) is
already abstracted.

---

## 6. Security checklist

All implemented in this repo; this is a checklist to audit before going
live.

- [x] `Strict-Transport-Security` (2 years, includeSubDomains, preload)
- [x] `Content-Security-Policy` — `frame-ancestors none`, `object-src none`,
      stripe + resend allow-lists (`next.config.js`)
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Permissions-Policy` — camera/mic/geo off, payments only to Stripe
- [x] `Cross-Origin-Opener-Policy: same-origin`
- [x] `Cross-Origin-Resource-Policy: same-origin`
- [x] `poweredByHeader: false`
- [x] Rate limits on every state-changing user-facing route
      (auth/register, review create, review report, review helpful,
      verification submit + code request + code confirm, group create +
      post + moderate + moderators, post comment + vote, connection
      create, favorite toggle, onboarding role, program request, stripe
      checkout + portal, admin onboarding, public search)
- [x] Middleware role gate on `/admin/*` + `/api/admin/*`
      (`src/middleware.ts`) — every page also re-checks server-side
- [x] CSV upload: 5 MB cap + MIME whitelist (`/api/admin/import`)
- [x] NextAuth credentials: bcrypt 12 rounds, login-failure tracker,
      generic error messages
- [x] Stripe webhook: signature verification, no signature → 400 without
      revealing secret state
- [x] Boot-time env validation throws in production on missing required vars
- [x] Audit log on every admin action (`src/lib/audit-log.ts`)

---

## 7. Error & loading states

- Global: `src/app/error.tsx`, `src/app/loading.tsx`, `src/app/not-found.tsx`
- Admin route group: `src/app/admin/(staff)/error.tsx`,
  `src/app/admin/(staff)/loading.tsx` — keeps the nav up when a queue
  page crashes, surfaces the Vercel `digest` for log correlation.

---

## 8. Pre-deploy commands

Run from your laptop before pushing the first deploy:

```bash
# 1. Apply schema to prod DB (unpooled URL temporarily).
DATABASE_URL='postgresql://...unpooled...?sslmode=require' \
  npx prisma db push --skip-generate

# 2. Regenerate the client locally (Vercel does this in the build too).
npx prisma generate

# 3. Typecheck + production build dry-run.
npx tsc --noEmit
npm run build

# 4. Seed the master admin against prod (once).
MASTER_ADMIN_EMAIL='you@example.com' \
MASTER_ADMIN_PASSWORD='...' \
DATABASE_URL='postgresql://...unpooled...' \
  npm run admin:create-master
```

Then on Vercel: **Deployments → Promote to Production**.

---

## 9. Smoke tests after first deploy

1. `https://<domain>/` loads, header + footer render, no console errors.
2. `https://<domain>/sign-up` → register → receive verification email.
3. `https://<domain>/pricing` → Stripe checkout → success →
   subscription appears in `/dashboard`.
4. `https://<domain>/admin` (signed in as master) → all five queue tiles
   render with live counts.
5. `https://<domain>/api/search?q=stanford` → returns JSON, hits the
   rate limit at 60 req / min from one IP.
6. Submit a review with a known harassment keyword → confirm it lands
   in `/admin/reviews?tab=flagged` and admins receive an email.

---

## 10. Day-2 ops

- **Logs:** Vercel → Project → Deployments → \[deployment\] → Functions
  → \[route\]. Stripe events also visible in Stripe dashboard.
- **Audit trail:** `/admin` shows the 10 most recent admin actions
  (master + `canViewAuditLogs` only).
- **DB connections:** if you ever see `too many connections` in the
  Function logs, verify `DATABASE_URL` is the **pooled** URL.
- **Rotating secrets:** rotate `NEXTAUTH_SECRET` only when you're
  comfortable invalidating every active session.
