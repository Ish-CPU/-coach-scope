# RateMyU

A transparency platform for college decision-making. Verified athletes, students, and parents share honest experiences. Anyone can read; participation requires a verified subscription.

> **Read free. Participate verified.**
> Participation requires a verified subscription to ensure real, accountable experiences.

Production-ready MVP built with Next.js (App Router), TypeScript, Tailwind, PostgreSQL via Prisma, NextAuth (JWT + credentials), and Stripe subscriptions (monthly + yearly).

---

## Two-layer access model

| Role | Weight | Can do |
|---|---|---|
| `VIEWER` (free) | 1.0 | browse all pages, read reviews, view ratings/grades, preview Verified Groups |
| `VERIFIED_ATHLETE` | **2.0** | rate coaches, programs, NIL, food, facilities, universities, dorms; participate in Athlete Groups |
| `VERIFIED_STUDENT` | **1.25** | rate universities, dorms, campus life; participate in Student Groups |
| `VERIFIED_PARENT` | **1.25** | submit structured parent insights (no numerical ratings); participate in Parent Groups |
| `ADMIN` | n/a | moderation queue + verification approvals + public-data imports |

Both layers (payment + role verification) are required to participate.

---

## Subscription

| Plan | Price |
|---|---|
| Monthly | **$5.99 / month** — billed every 30 days from your signup date |
| Yearly | **$69.99 / year** — save compared to monthly billing |

Payment methods: card, Apple Pay, Google Pay (PayPal coming soon).

---

## Supported sports

Single source of truth: [`src/lib/sports.ts`](src/lib/sports.ts).

```
Men's:    Football · Baseball · Men's Basketball · Men's Soccer
Women's:  Softball · Women's Basketball · Women's Soccer
```

Levels: NCAA Division I, II, III; NAIA; JUCO / Community College (NJCAA).

---

## Public-data import (2025–2026)

RateMyU only stores **factual public directory data** for universities, programs, coaches, dorms, dining, and athletic facilities. **Never** copy reviews from third-party platforms (Rate My Professors, Niche, ESPN, On3, Rivals, etc.).

### What you can import

- **Universities** — name, city, state, official website, description.
- **Programs** — sport (must be supported), division, conference, official athletics URL.
- **Coaches** — name, title, sport (auto-creates the program if missing).
- **Dorms / Residence halls** — name, optional description, link to housing page.
- **Dining** — name, location, hours, link to dining page.
- **Athletic facilities** — name, optional sport tag, type (Stadium / Arena / Practice Facility / Weight Room / etc.).

Every imported record carries source tracking:

- `sourceUrl` — link to the official page you copied from
- `sourceName` — human label (e.g. `gostanford.com — baseball staff page`)
- `seasonYear` — defaults to `2025-2026`
- `lastVerifiedAt` — defaults to “now” at import time

If you can't verify a value from an official source, **leave the field blank** — never guess.

### CSV templates + samples

```
seed/
├── README.md             # rules + import order
├── templates/            # header-only CSVs you copy to start a new import
│   ├── universities.csv
│   ├── programs.csv
│   ├── coaches.csv
│   ├── dorms.csv
│   ├── dining.csv
│   └── facilities.csv
└── samples/              # small demo files, every row marked DEMO — verify before publishing
    ├── universities.csv
    ├── programs.csv
    ├── coaches.csv
    ├── dorms.csv
    ├── dining.csv
    └── facilities.csv
```

### How to import

CLI (uses `DATABASE_URL` from `.env`):

```bash
# load all sample CSVs in dependency order
npm run db:import:samples

# or one type at a time
npm run db:import -- universities seed/samples/universities.csv
npm run db:import -- programs     path/to/programs.csv
npm run db:import -- coaches      path/to/coaches.csv
npm run db:import -- dorms        path/to/dorms.csv
npm run db:import -- dining       path/to/dining.csv
npm run db:import -- facilities   path/to/facilities.csv
```

Admin UI (signed in as ADMIN): visit `/admin/import`, pick a type, upload the CSV. The page reports `created / updated / skipped` and per-row error messages.

### Import order

There are foreign-key dependencies — load in this order:

```
universities → programs → coaches → dorms / dining / facilities
```

The `coaches` importer auto-creates a missing program (school) so you can run them independently if you only have coaches data.

### Validation rules

- **Sports** outside the supported list are rejected.
- **Divisions** accept `NCAA Division I/II/III`, `NAIA`, `JUCO`, `Community College`, `NJCAA`, plus the short codes `D1`/`D2`/`D3` (case-insensitive).
- Files larger than 5 MB are rejected on the admin upload endpoint.
- Reviews, ratings, posts, comments, and votes are **never imported** — they only come from verified users.

---

## Score, percentage, letter grade

[`src/lib/review-weighting.ts`](src/lib/review-weighting.ts) exports:

```ts
calculateWeightedAverage(items: { value: number; weight: number }[]): number
convertRatingToPercentage(rating: number): number   // (avg/5)*100
convertRatingToLetterGrade(rating: number): string  // A+, A, A-, …, F
```

Every coach / program / university / dorm / search-result card shows: **letter grade · `4.6 / 5` · `92%` · review count**.

Rating filters use: `Any Rating · 1+ · 2+ · 3+ · 4+ · 4.5+`.

---

## Folder structure

```
src/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── import/route.ts                  # CSV upload endpoint
│   │   │   ├── reports/[id]/route.ts
│   │   │   └── verifications/[id]/route.ts
│   │   ├── auth/...
│   │   ├── reviews/...
│   │   ├── stripe/...
│   │   ├── verification/...
│   │   ├── groups/...
│   │   └── posts/[id]/{comments,vote}/route.ts
│   ├── admin/
│   │   ├── page.tsx
│   │   ├── import/page.tsx                      # public-data import UI
│   │   ├── reports/page.tsx
│   │   └── verifications/page.tsx
│   ├── coach/[id]/page.tsx
│   ├── university/[id]/page.tsx                 # now lists dorms + dining + facilities
│   ├── dorm/[id]/page.tsx
│   ├── pricing/page.tsx
│   ├── verification/page.tsx
│   ├── groups/...
│   └── ...
├── components/
│   ├── admin/{ImportForm, ReportRow, VerificationRow}.tsx
│   ├── verification/{AthleteVerificationForm, EmailCodeVerificationForm}.tsx
│   ├── groups/{CreateGroupForm, CreatePostForm, PostListItem, VoteButtons, ...}.tsx
│   ├── Badge, GradeBadge, RatingFilter, RatingStars, RatingSummary.tsx
│   ├── ReviewCard, ReviewForm, ResultCard, PaymentIcons.tsx
│   └── SiteHeader, SiteFooter, SearchBar, ManageBillingButton, Providers.tsx
├── lib/
│   ├── import-csv.ts                            # parser + validator + upsert
│   ├── permissions.ts
│   ├── verification.ts
│   ├── review-weighting.ts                      # weights + grade + percentage + sort
│   ├── review-schemas.ts
│   ├── rating-filter.ts                         # Any/1+/2+/3+/4+/4.5+
│   ├── sports.ts                                # supported sports
│   ├── groups.ts
│   ├── anonymous.ts
│   ├── stripe.ts
│   ├── search.ts
│   ├── url.ts
│   ├── auth.ts, prisma.ts, cn.ts
└── middleware.ts                                # /admin gate

scripts/
└── import-csv.ts                                # CLI wrapper

seed/
├── README.md
├── templates/  (header-only)
└── samples/    (demo, marked “verify before publishing”)
```

---

## Local development

See [SETUP.md](SETUP.md). Short version:

```bash
npm install
cp .env.example .env       # set DATABASE_URL, NEXTAUTH_SECRET, Stripe keys
npm run db:push && npm run db:seed
npm run db:import:samples  # optional — load demo public data
npm run stripe:listen      # second terminal — paste whsec_… into .env
npm run dev
```
