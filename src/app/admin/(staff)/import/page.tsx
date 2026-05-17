import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/permissions";
import { ImportForm } from "@/components/admin/ImportForm";
import { IMPORT_TYPES } from "@/lib/import-csv";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const session = await getSession();
  if (!isAdmin(session)) redirect("/");

  // Dorm-coverage stats. Cheap aggregate queries — three counts, one
  // groupBy. Rendered as a banner above the import form so a researcher
  // running the coverage workflow sees immediate progress numbers.
  const [universitiesTotal, totalDorms, universitiesWithDormsRaw] =
    await Promise.all([
      prisma.university.count(),
      prisma.dorm.count(),
      prisma.dorm.groupBy({
        by: ["universityId"],
        _count: { _all: true },
      }),
    ]);
  const universitiesWithDorms = universitiesWithDormsRaw.length;
  const universitiesMissingDorms = universitiesTotal - universitiesWithDorms;
  const dormCoveragePct =
    universitiesTotal === 0
      ? 0
      : Math.round((universitiesWithDorms / universitiesTotal) * 100);

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold">Public-data import</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Upload CSVs of <strong>public, factual</strong> directory data —
        university names, locations, divisions, conferences, official athletics
        sites, coaches, dorms, dining, athletic facilities. Reviews and
        ratings are <strong>not</strong> imported here — those must come from
        verified users.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Source rules: official .edu pages, official athletics sites, official
        housing pages, official dining pages. Never copy reviews from third-party
        platforms (Rate My Professors, Niche, ESPN, On3, Rivals, etc.).
      </p>

      {/* Dorm coverage banner. Lives above the import form so the worksheet
          flow (export → research → import → re-export) is one glance away. */}
      <section
        aria-labelledby="dorm-coverage-heading"
        className="mt-6 card p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2
            id="dorm-coverage-heading"
            className="text-lg font-semibold"
          >
            Dorm coverage
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              dormCoveragePct >= 80
                ? "bg-emerald-100 text-emerald-800"
                : dormCoveragePct >= 40
                ? "bg-amber-100 text-amber-800"
                : "bg-red-100 text-red-800"
            }`}
            title={`${universitiesWithDorms}/${universitiesTotal}`}
          >
            {dormCoveragePct}% covered
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Universities total" value={universitiesTotal} />
          <Stat label="Universities with dorms" value={universitiesWithDorms} />
          <Stat
            label="Universities missing dorms"
            value={universitiesMissingDorms}
            highlight={universitiesMissingDorms > 0}
          />
          <Stat label="Total dorms in DB" value={totalDorms} />
        </div>
        <details className="mt-4 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            Dorm backfill workflow (export → research → import)
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              From your laptop run{" "}
              <code className="rounded bg-slate-100 px-1">
                npm run dorms:missing
              </code>{" "}
              — writes{" "}
              <code className="rounded bg-slate-100 px-1">
                data/exports/missing-dorms.csv
              </code>{" "}
              with every university that currently has 0 dorms.
            </li>
            <li>
              Open the CSV. For each row, visit the university's{" "}
              <code className="rounded bg-slate-100 px-1">housingUrl</code> (or
              find one starting from{" "}
              <code className="rounded bg-slate-100 px-1">websiteUrl</code>) and
              harvest the residence halls list from the official Housing /
              Residence Life page. <strong>Never invent dorm names.</strong>{" "}
              Leave a university blank if you can't verify it from an official
              source.
            </li>
            <li>
              Build a dorms CSV using the header at the bottom of this card and
              upload it below (type:{" "}
              <code className="rounded bg-slate-100 px-1">dorms</code>). The
              importer is idempotent — re-uploads update existing rows; nothing
              is duplicated or deleted.
            </li>
            <li>
              Re-run{" "}
              <code className="rounded bg-slate-100 px-1">
                npm run dorms:missing
              </code>{" "}
              to see the new coverage. The CSV shrinks by however many
              universities just gained a dorm.
            </li>
          </ol>
          <p className="mt-3 font-medium text-slate-700">
            Dorm CSV header:
          </p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-2 text-[11px] leading-snug text-slate-700">
{`name,slug,universityName,city,state,roomType,bathroomType,yearBuilt,capacity,officialPageUrl,description,imageUrl,sourceUrl,sourceName,seasonYear,lastVerifiedAt`}
          </pre>
          <p className="mt-2 text-[11px] text-slate-500">
            Only <code>name</code> and <code>universityName</code> are required.{" "}
            <code>roomType</code> ∈ {`{Single, Double, Suite, Apartment}`}.{" "}
            <code>bathroomType</code> ∈ {`{Private, Shared, Communal}`}. Per-dorm
            housing page goes in{" "}
            <code>officialPageUrl</code>; provenance in{" "}
            <code>sourceUrl</code> / <code>sourceName</code>.
          </p>
        </details>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <ImportForm types={IMPORT_TYPES} />

        <aside className="card p-4">
          <h2 className="text-sm font-semibold">Reference</h2>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            <li>• Import order: universities → programs → coaches → dorms / dining / facilities.</li>
            <li>• Sports must be one of the supported sports (Football, Baseball, Softball, Men&apos;s/Women&apos;s Basketball, Men&apos;s/Women&apos;s Soccer).</li>
            <li>• Divisions accepted: NCAA Division I/II/III, NAIA, JUCO / Community College / NJCAA.</li>
            <li>• Leave a field blank if you can&apos;t verify it — never guess.</li>
            <li>• <code>seasonYear</code> defaults to <code>2025-2026</code>.</li>
            <li>• <code>lastVerifiedAt</code> defaults to now if blank.</li>
            <li>
              • Dorm coverage worksheet:{" "}
              <code>npm run dorms:missing</code> →{" "}
              <code>data/exports/missing-dorms.csv</code>.
            </li>
          </ul>
          <h3 className="mt-4 text-sm font-semibold">Templates</h3>
          <p className="mt-1 text-xs text-slate-500">
            Header-only files live in <code>seed/templates/</code>; small demo
            files in <code>seed/samples/</code> in this repo.
          </p>
        </aside>
      </div>
    </div>
  );
}

/**
 * Compact stat card used by the coverage banner. Highlight tone is reused
 * from the admin home page Stat helper so the visual language is consistent.
 */
function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-amber-300 bg-amber-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          highlight ? "text-amber-800" : "text-slate-900"
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
