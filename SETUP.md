# Local development setup

Step-by-step guide to running MyUniversityVerified on your machine. From a clean clone to a running app in ~10 minutes.

---

## 0. Prerequisites

| Tool | Version | Why |
|---|---|---|
| **Node.js** | ≥ 18.17 (20.x recommended) | Next.js 14 runtime |
| **npm** | ≥ 9 | Package manager (or pnpm/yarn — examples use npm) |
| **PostgreSQL** | ≥ 14 | Primary database |
| **Stripe CLI** | latest | Forwards webhook events to localhost |

Check what you have:

```bash
node --version    # v20.x.x
npm --version     # 10.x.x
psql --version    # PostgreSQL 14+
stripe --version  # stripe version 1.x.x
```

Install anything missing:

```bash
# macOS (Homebrew)
brew install node postgresql@16 stripe/stripe-cli/stripe

# Linux (apt)
sudo apt install nodejs npm postgresql
# Stripe CLI: see https://docs.stripe.com/stripe-cli
```

---

## 1. Install dependencies

From the project root:

```bash
npm install
```

This installs Next.js, Prisma, NextAuth, Stripe, Tailwind, and dev tooling. The `postinstall` script automatically runs `prisma generate` so the typed Prisma client exists right after install.

---

## 2. Start a local PostgreSQL database

Pick **one** of the following.

### Option A — Docker (fastest, no Postgres install needed)

```bash
docker run -d \
  --name univerified-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=univerified \
  -p 5432:5432 \
  postgres:16
```

Connection string: `postgresql://postgres:postgres@localhost:5432/univerified?schema=public`

### Option B — Homebrew Postgres (macOS)

```bash
brew services start postgresql@16
createdb univerified
```

Connection string: `postgresql://$(whoami)@localhost:5432/univerified?schema=public`

### Option C — Hosted (Neon / Supabase / Railway / Vercel Postgres)

Create a free Postgres instance and copy the `postgresql://…` connection string from the dashboard.

> **Tip:** if you're using a hosted DB that requires SSL, append `&sslmode=require` to the URL.

---

## 3. Create your `.env` file

Copy the example file and fill it in:

```bash
cp .env.example .env
```

Open `.env` and set each variable as described below.

### 3a. `DATABASE_URL`

Paste the connection string from step 2.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/univerified?schema=public"
```

### 3b. `NEXTAUTH_URL`

The base URL the app runs on. For local dev:

```env
NEXTAUTH_URL="http://localhost:3000"
```

(In production this becomes your real domain, e.g. `https://myuniversityverified.com`.)

### 3c. `NEXTAUTH_SECRET`

Used to sign JWTs. Generate a strong random value:

```bash
openssl rand -base64 32
```

Copy the output into `.env`:

```env
NEXTAUTH_SECRET="paste-the-32-byte-base64-string-here"
```

> Never commit this value. `.env` is already in `.gitignore`.

### 3d. `NEXT_PUBLIC_APP_URL`

Same as `NEXTAUTH_URL` for local dev — used by Stripe success/cancel redirects.

```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3e. Stripe keys (required for the subscription flow)

1. Sign in at <https://dashboard.stripe.com> and switch to **Test mode** (toggle in the top-right).
2. Developers → API keys — copy the **Secret key** (`sk_test_…`) and **Publishable key** (`pk_test_…`).
3. Product catalog → Add product → name “Verified Member”. Add **two recurring prices**:
   - Monthly: **$5.99 / month**
   - Yearly: **$55.99 / year** (saves ~22% vs paying monthly)
4. Copy each price ID (`price_…`).
5. (Optional) under **Settings → Payment methods**, enable Apple Pay and Google Pay; you'll need to add and verify your domain there too. Card payments work without any extra setup.

Add to `.env`:

```env
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_PRICE_MONTHLY_ID="price_..."
STRIPE_PRICE_YEARLY_ID="price_..."
# STRIPE_WEBHOOK_SECRET — set in step 6 below
```

> **Skipping Stripe for now?** The app boots without it, but `/pricing` checkout, the dashboard's “Manage billing” button, and the webhook will return errors when you click them. Everything else (browsing, search, sign-in/up, admin) still works.

---

## 4. Generate the Prisma client

`npm install` already ran this via `postinstall`, but run it again manually any time you change `prisma/schema.prisma`:

```bash
npx prisma generate
```

This regenerates `node_modules/.prisma/client` so the typed `prisma.user.findMany(...)` etc. match your schema.

---

## 5. Push the schema and seed demo data

Push the schema to your database (creates all tables, indexes, enums):

```bash
npm run db:push
```

> Use `npm run db:push` for early development. When you're ready to track schema history with proper migrations, switch to `npm run db:migrate` (which runs `prisma migrate dev`).

Seed test users + empty Verified Groups (no synthetic reviews — those only come from verified users):

```bash
npm run db:seed
```

You should see:

```
🌱 Seeding MyUniversityVerified test users...
✅ Seeded users + empty groups.
   No reviews / ratings / posts were created — those are user-generated.
   To load public factual data:  npm run db:import:samples

Test logins (password: password123):
  admin@ratemyu.app    -> ADMIN
  athlete@ratemyu.app  -> VERIFIED_ATHLETE  (paid + verified)
  student@ratemyu.app  -> VERIFIED_STUDENT  (paid + verified)
  parent@ratemyu.app   -> VERIFIED_PARENT   (paid + verified)
  pending@ratemyu.app  -> VERIFIED_STUDENT  (paid, NOT yet verified)
  viewer@ratemyu.app   -> VIEWER (free)
```

### 5a. (Optional) Load public factual data

The seed leaves universities, coaches, dorms, dining, and athletic facilities empty on purpose — MyUniversityVerified's policy is to import only **public, factual** directory data from official sources. Two ways to populate it:

**A. Load the sample CSVs** (clearly marked `DEMO — verify before publishing`):

```bash
npm run db:import:samples
```

**B. Import your own CSVs** in dependency order:

```bash
npm run db:import -- universities path/to/universities.csv
npm run db:import -- programs     path/to/programs.csv
npm run db:import -- coaches      path/to/coaches.csv
npm run db:import -- dorms        path/to/dorms.csv
npm run db:import -- dining       path/to/dining.csv
npm run db:import -- facilities   path/to/facilities.csv
```

Header-only CSV templates live in `seed/templates/`. Demo files in `seed/samples/`. Rules and column reference: [seed/README.md](seed/README.md).

You can also upload CSVs from the admin UI at `/admin/import` once signed in as `admin@ratemyu.app`.

To browse the database visually:

```bash
npm run db:studio
```

Opens Prisma Studio at <http://localhost:5555>.

---

## 6. Forward Stripe webhooks (only needed if testing subscriptions)

In a **separate terminal**, run:

```bash
npm run stripe:listen
```

(equivalent to `stripe listen --forward-to localhost:3000/api/stripe/webhook`)

The first time, it'll prompt you to sign in via browser. Once running, it prints:

```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxx
```

Copy that `whsec_…` value into `.env`:

```env
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxx"
```

Leave the `stripe listen` process running — every event Stripe receives in test mode will be forwarded to your local webhook handler.

---

## 7. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>.

Sign in with any of the seeded accounts (password is `password123` for all):

- `admin@ratemyu.app` → can access `/admin`
- `athlete@ratemyu.app` → can rate coaches, programs, universities, dorms; post in Athlete Groups
- `student@ratemyu.app` → can rate universities + dorms; post in Student Groups
- `parent@ratemyu.app` → can submit parent insights; post in Parent Groups
- `pending@ratemyu.app` → paid but role-verification incomplete — useful for testing the verification gate
- `viewer@ratemyu.app` → free, read-only

To test the full flow as a fresh user:

1. `/sign-up` → create account.
2. `/pricing` → **pick a role** (the Subscribe button stays disabled until you do), pick monthly/yearly, click Subscribe.
3. Stripe Checkout opens. Use card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
4. On success you're redirected to `/verification`. Webhook stamps `paymentVerified=true`, role=selectedRole, `verificationStatus=PENDING`.
5. Complete role verification:
   - Athlete: choose .edu email (code), roster link, or manual proof.
   - Student: .edu email + 6-digit code (code is logged to the dev server console — look for `[verification] purpose=STUDENT_EDU`).
   - Parent: any email + 6-digit code, optional manual review later.
6. Once verified, `/review/new` and posting in your audience's group unlock.

To test the full payment flow as a fresh user:

1. `/sign-up` → create a new account.
2. `/pricing` → click **Subscribe**.
3. Stripe Checkout opens. Use card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
4. On success you're redirected to `/dashboard`. Within a second the webhook updates your role to `VERIFIED_MEMBER` and `subscriptionStatus` to `ACTIVE` — refresh to see it reflected in the header badge.
5. Now `/review/new` is unlocked.

---

## Common scripts

```bash
npm run dev            # start dev server (http://localhost:3000)
npm run build          # production build (runs prisma generate first)
npm start              # serve the production build
npm run lint           # eslint

npm run db:push        # push schema to DB (no migration history)
npm run db:migrate     # create + apply a new migration
npm run db:seed        # run prisma/seed.ts
npm run db:studio      # GUI on :5555

npm run stripe:listen  # forward Stripe webhooks to localhost
```

---

## Troubleshooting

**`Error: P1001 Can't reach database server`** — Postgres isn't running, or `DATABASE_URL` is wrong. For Docker: `docker start univerified-pg`.

**`PrismaClientInitializationError: Environment variable not found: DATABASE_URL`** — `.env` doesn't exist or isn't being read. Make sure you `cp .env.example .env` (not `env.example` etc.), and that you didn't put the file in a subdirectory.

**`[next-auth][error][NO_SECRET]`** — `NEXTAUTH_SECRET` is missing or empty. Re-generate with `openssl rand -base64 32` and restart `npm run dev`.

**Stripe webhook returns 400 `Webhook Error: No signatures found matching…`** — `STRIPE_WEBHOOK_SECRET` doesn't match the one printed by `stripe listen`. Re-copy it and restart the dev server.

**Cannot find module `@prisma/client`** — run `npx prisma generate`.

**Schema changed and types are stale** — run `npx prisma generate` and restart your editor's TypeScript server (in VS Code: ⇧⌘P → "TypeScript: Restart TS Server").

**Port 3000 already in use** — `PORT=3001 npm run dev`, then update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to match.

---

## Resetting your local database

If your data gets messy:

```bash
npx prisma db push --force-reset   # drops all tables, recreates from schema
npm run db:seed                    # re-seed
```

> **Heads up — `UserRole` and `GroupType` enums changed.** If you're upgrading from an earlier version of this repo, `db push` will fail because old `PARENT` / `VERIFIED_MEMBER` rows and old `GroupType` values can't coerce into the new enum. Use `--force-reset` (above) for local dev. For a real production migration, write a SQL migration that updates rows first (e.g. `UPDATE "User" SET role='VERIFIED_PARENT' WHERE role='PARENT'`) before letting Prisma drop the old enum.

Or, with Docker, nuke the whole instance:

```bash
docker rm -f univerified-pg
# then re-run the docker run command from step 2
```
