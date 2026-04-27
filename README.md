# Coach Scope

A transparency platform for college decision-making. Verified athletes, students, and parents share honest experiences. Anyone can read; participation requires a verified subscription.

> **Read free. Participate verified.**
> Participation requires a verified subscription to ensure real, accountable experiences.

Production-ready MVP built with Next.js (App Router), TypeScript, Tailwind, PostgreSQL via Prisma, NextAuth (JWT + credentials), and Stripe subscriptions (monthly + yearly).

---

## Two-layer access model

```
              ┌──────────────────────────┐
              │  Layer 1: Payment         │
              │  Stripe → paymentVerified │
              └─────────────┬────────────┘
                            │ on success
                            ▼
              ┌──────────────────────────┐
              │  Layer 2: Role            │
              │  EDU email / roster /     │
              │  manual proof / parent doc│
              └──────────────────────────┘
```

| Role | Weight | Can do |
|---|---|---|
| `VIEWER` (free) | 1.0 | browse all pages, read reviews, view ratings/grades, preview Verified Groups |
| `VERIFIED_ATHLETE` | **2.0** | rate coaches, programs, NIL, food, facilities, universities, dorms; participate in Athlete Groups |
| `VERIFIED_STUDENT` | **1.25** | rate universities, dorms, campus life; participate in Student Groups |
| `VERIFIED_PARENT` | **1.25** | submit structured parent insights (no numerical ratings); participate in Parent Groups |
| `ADMIN` | n/a | moderation queue + verification approvals |

Both layers are required to participate. The webhook stamps `paymentVerified=true` on activation; `verificationStatus=VERIFIED` only happens after the role-specific verification flow succeeds.

---

## Subscription

| Plan | Price |
|---|---|
| Monthly | **$5.99 / month** — billed every 30 days from your signup date |
| Yearly | **$69.99 / year** — save compared to monthly billing |

Payment methods supported via Stripe Checkout: **Visa, Mastercard, debit/credit cards, Apple Pay, Google Pay.** PayPal is rendered as “coming soon” in the UI; the architecture is ready to swap in once Stripe PayPal is enabled.

### Role selection happens BEFORE checkout

`/pricing` requires the user to choose a role (Athlete / Student / Parent) before the **Subscribe** button enables. The selection is sent to the checkout endpoint, which writes it into Stripe metadata as `selectedRole`. The webhook reads it back and:

1. sets `paymentVerified = true`
2. promotes the user from `VIEWER` to the chosen role
3. sets `verificationStatus = PENDING`
4. redirects them into `/verification` for the role-specific second step

---

## Role verification flows

### Verified Student
- Email-code flow against a `.edu` address.
- Server validates the domain, generates a 6-digit code, hashes it (`bcrypt`), and persists with a 15-minute TTL.
- POST `/api/verification/code/request` then `/api/verification/code/confirm`.
- In dev, the code is logged to the server console and returned in the response (`devCode`) so you don't need an email provider yet.

### Verified Athlete (strict)
Three options, **one** required:
1. **`.edu` Email** — same email-code flow as Student.
2. **Roster Link** — official athletics URL only. Shorteners (`bit.ly`) and Google Drive links are rejected. Roster validation is a heuristic on the host (`.edu` / official athletics `.com`); admin still confirms.
3. **Manual upload** — placeholder URL today. **Never auto-approves.** Always lands in `/admin/verifications` for review.

Anti-fake controls (in [`src/lib/verification.ts`](src/lib/verification.ts) and the API routes):
- Max 5 verification attempts per user per 24h (logged + counted).
- Each attempt creates a `VerificationRequest` row with `attemptNumber` so admins see the full history.
- Code mismatches log a `REJECTED` request for the audit trail.

### Verified Parent
Email verification (any address) plus optional manual review. Submits structured insights only — no numerical ratings.

---

## Group segmentation

Three audience-segmented `GroupType` values:

| Group | Who can post / comment / vote |
|---|---|
| `ATHLETE_GROUP` | `VERIFIED_ATHLETE` only |
| `STUDENT_GROUP` | `VERIFIED_STUDENT` only |
| `PARENT_GROUP` | `VERIFIED_PARENT` only |

Free users + signed-in users in the wrong audience get a 5-post **preview** and an upgrade prompt. The audience check is enforced at every API mutation: post create, comment, vote.

Reddit-style voting:
- One vote per user per post (unique on `(userId, postId)`).
- Toggle ±1 / remove. `GroupPost.upvoteCount`, `downvoteCount`, `totalScore`, `commentCount` are kept in sync inside a transaction.
- Sort: **Top · New · Most Commented · Controversial.**

---

## Athlete-side rating categories

Final coach / program review categories — submitted by `VERIFIED_ATHLETE` only:

`recruitingHonesty · communication · playerTreatment · development · trustworthiness · teamCulture · nilOpportunity · foodRating · facilityRating · overallRating`

University / dorm review categories — submitted by `VERIFIED_ATHLETE` or `VERIFIED_STUDENT`:

`dormQuality · campusSafety · socialLife · foodQuality · facilities · academicSupport · overallExperience`

Parent insight categories — `VERIFIED_PARENT` only:

`coachCommunication · recruitingHonesty · programEnvironment · athleteSupport · overallRating`

### Score, percentage, letter grade

Three pure helpers in [`src/lib/review-weighting.ts`](src/lib/review-weighting.ts):

```ts
calculateWeightedAverage(items: { value: number; weight: number }[]): number
convertRatingToPercentage(rating: number): number   // (avg/5)*100
convertRatingToLetterGrade(rating: number): string  // A+, A, A-, …, F
```

Used by `<GradeBadge />` and `<RatingSummary />`. Every coach / program / university / dorm / search-result card shows letter grade · percentage · review count.

---

## Folder structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── auth/register/route.ts                        # creates a free VIEWER
│   │   ├── reviews/route.ts                              # role-gated by canSubmitReviewType
│   │   ├── reviews/[id]/{helpful,report}/route.ts
│   │   ├── favorites/route.ts
│   │   ├── search/route.ts
│   │   ├── stripe/checkout/route.ts                      # accepts { interval, selectedRole }
│   │   ├── stripe/portal/route.ts
│   │   ├── stripe/webhook/route.ts                       # writes paymentVerified + role + PENDING
│   │   ├── verification/route.ts                         # athlete roster / parent doc / etc
│   │   ├── verification/code/request/route.ts            # NEW — student/parent email code
│   │   ├── verification/code/confirm/route.ts            # NEW
│   │   ├── admin/{reports,verifications}/[id]/route.ts
│   │   ├── groups/route.ts                               # audience match enforced
│   │   ├── groups/[slug]/posts/route.ts
│   │   └── posts/[id]/{comments,vote}/route.ts
│   ├── pricing/page.tsx                                  # role selection + interval toggle
│   ├── sign-up/page.tsx                                  # free VIEWER, redirects to /pricing
│   ├── verification/page.tsx                             # routes to per-role flow
│   ├── dashboard/page.tsx                                # two-layer status banners
│   ├── coach/[id]/page.tsx
│   ├── university/[id]/page.tsx
│   ├── dorm/[id]/page.tsx
│   ├── review/new/page.tsx                               # role-aware allowed types
│   ├── groups/{page,new/page,[slug]/page,[slug]/new/page,[slug]/posts/[postId]/page}.tsx
│   └── admin/...
├── components/
│   ├── verification/
│   │   ├── EmailCodeVerificationForm.tsx                 # NEW — request + confirm code
│   │   └── AthleteVerificationForm.tsx                   # NEW — three tabs
│   ├── groups/
│   │   ├── CreateGroupForm.tsx                           # honors fixed audience
│   │   ├── CreatePostForm.tsx
│   │   ├── PostListItem.tsx
│   │   ├── VoteButtons.tsx
│   │   ├── CommentForm.tsx
│   │   └── CommentList.tsx
│   ├── Badge.tsx, GradeBadge.tsx, RatingStars.tsx, RatingSummary.tsx
│   ├── ReviewCard.tsx, ReviewForm.tsx, ResultCard.tsx
│   ├── PaymentIcons.tsx
│   ├── UpgradePrompt.tsx
│   └── SiteHeader.tsx, SiteFooter.tsx, SearchBar.tsx, ManageBillingButton.tsx, Providers.tsx
├── lib/
│   ├── permissions.ts                                    # canParticipate / canSubmitReviewType / canParticipateInGroup
│   ├── verification.ts                                   # NEW — code gen, hashing, attempt limits, .edu validation, roster heuristic
│   ├── review-weighting.ts                               # weights + grade + percentage + sort
│   ├── review-schemas.ts                                 # zod per ReviewType
│   ├── anonymous.ts                                      # anonymous display names
│   ├── groups.ts                                         # GROUP_TYPE_LABELS / DESCRIPTIONS / sort enum
│   ├── stripe.ts                                         # MONTHLY + YEARLY price helpers
│   ├── search.ts
│   ├── auth.ts, prisma.ts, cn.ts
└── middleware.ts                                         # /admin gate
```

---

## Local development

See [SETUP.md](SETUP.md). Short version:

```bash
npm install
cp .env.example .env       # set DATABASE_URL, NEXTAUTH_SECRET, Stripe keys
npm run db:push && npm run db:seed
npm run stripe:listen      # second terminal — paste whsec_... into .env
npm run dev
```

> ⚠️ **Schema changed.** The `UserRole` and `GroupType` enums dropped values (`VERIFIED_MEMBER`, the old `GroupType` topic enum) and renamed (`PARENT` → `VERIFIED_PARENT`). On an existing database run `npx prisma db push --force-reset && npm run db:seed`. Production migrations should map old roles before dropping (see "migrating an existing DB" in [SETUP.md](SETUP.md)).

---

## Backwards compatibility notes

- `permissions.ts` still re-exports the old function names (`canPostReviews`, `canPostInGroups`, `canVoteOnPosts`, `whyCannotPost`) so any external integration code that imported them keeps compiling. They now alias to `canParticipate` / `whyCannotParticipate`.
- The Stripe webhook tolerates older subscriptions without `selectedRole` metadata — those users keep their existing role and just get `paymentVerified=true`.
- The `STRIPE_PRICE_ID` env var still works as a monthly fallback if you don't want to migrate config.

---

## What you might add next

- Real PayPal integration (UI already advertises “coming soon”).
- File upload for verification proof — wire `proofUrl` to S3/R2/UploadThing.
- Comment voting UI (`GroupCommentVote` table is in place).
- `Resend` / `SendGrid` integration in `sendVerificationEmail`.
- Per-school audience-scoped groups (e.g. an athlete group restricted to one university).
