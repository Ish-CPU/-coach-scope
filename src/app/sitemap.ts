import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Each query is wrapped so a DB outage produces a sitemap with just the
  // static routes instead of a 500 to crawlers.
  const [universities, coaches, dorms] = await Promise.all([
    safe(
      () => prisma.university.findMany({ select: { id: true, updatedAt: true } }),
      [],
      "sitemap:universities"
    ),
    safe(
      () => prisma.coach.findMany({ select: { id: true, updatedAt: true } }),
      [],
      "sitemap:coaches"
    ),
    safe(
      () => prisma.dorm.findMany({ select: { id: true, updatedAt: true } }),
      [],
      "sitemap:dorms"
    ),
  ]);

  const stat = ["/", "/pricing", "/search", "/groups", "/guidelines", "/sign-in", "/sign-up"].map(
    (p) => ({ url: `${base}${p}`, lastModified: new Date() })
  );

  return [
    ...stat,
    ...universities.map((u) => ({ url: `${base}/university/${u.id}`, lastModified: u.updatedAt })),
    ...coaches.map((c) => ({ url: `${base}/coach/${c.id}`, lastModified: c.updatedAt })),
    ...dorms.map((d) => ({ url: `${base}/dorm/${d.id}`, lastModified: d.updatedAt })),
  ];
}
