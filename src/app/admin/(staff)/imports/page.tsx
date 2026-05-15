import { redirect } from "next/navigation";

// /admin/imports is the spec-named entry point — keep the existing CSV
// import workflow at /admin/import as the canonical route and bounce here
// so links in the new nav don't 404.
export default function AdminImportsAlias() {
  redirect("/admin/import");
}
