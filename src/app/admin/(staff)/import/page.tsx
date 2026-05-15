import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/permissions";
import { ImportForm } from "@/components/admin/ImportForm";
import { IMPORT_TYPES } from "@/lib/import-csv";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const session = await getSession();
  if (!isAdmin(session)) redirect("/");

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
