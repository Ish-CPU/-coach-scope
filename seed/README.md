# RateMyU public-data import

Two folders:

- `templates/` — header-only CSVs. Copy one when you're starting a new import.
- `samples/` — small demo files with a few rows pre-populated and clearly marked
  `DEMO — verify before publishing` in the `sourceName` column. They link to
  the actual official athletics / housing / dining pages so you can confirm
  the current 2025–2026 details yourself.

## Rules for public-data CSVs

- Use **only** factual public directory information from official sources:
  university `.edu` pages, official athletics sites, official school housing
  pages, official dining pages, official roster / coach pages.
- **Never** include reviews, opinions, ratings, or content scraped from review
  platforms (Rate My Professors, Niche, ESPN, On3, Rivals, etc.).
- If you can't verify a current 2025–2026 value, leave the field blank
  instead of guessing. The importer accepts blanks gracefully.
- Sports must be one of: Football, Baseball, Softball, Men's Basketball,
  Women's Basketball, Men's Soccer, Women's Soccer. Anything else is rejected.
- `division` accepts: `NCAA Division I`, `NCAA Division II`, `NCAA Division III`,
  `JUCO`, `Community College`, `NAIA`. Case-insensitive aliases like `D1` /
  `NJCAA` also work.
- `seasonYear` defaults to `2025-2026` when blank.
- `lastVerifiedAt` is auto-stamped to "now" if blank.

## Import order

There are foreign-key dependencies, so import in this order:

1. `universities.csv`
2. `programs.csv` (sport + division + conference)
3. `coaches.csv` (auto-creates a program if missing)
4. `dorms.csv`, `dining.csv`, `facilities.csv` (any order)

## How to run

CLI (uses `DATABASE_URL` from `.env`):

```bash
# import a single file
npm run db:import -- universities seed/samples/universities.csv
npm run db:import -- coaches seed/samples/coaches.csv

# import all sample files in dependency order
npm run db:import:samples
```

Admin UI (signed in as ADMIN):

- Visit `/admin/import`
- Pick a type, upload a CSV, hit Import. The page reports
  `created / updated / skipped` plus per-row error messages.
