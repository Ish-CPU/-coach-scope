import { redirect } from "next/navigation";

// /admin/dashboard is an alias for /admin so external links / muscle memory
// keep working. The real dashboard lives at /admin/page.tsx.
export default function AdminDashboardAlias() {
  redirect("/admin");
}
