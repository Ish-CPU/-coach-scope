import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const [universities, coaches, dorms] = await Promise.all([
    prisma.university.findMany({ select: { id: true, updatedAt: true } }),
    prisma.coach.findMany({ select: { id: true, updatedAt: true } }),
    prisma.dorm.findMany({ select: { id: true, updatedAt: true } }),
  ]);

  const stat = ["/", "/pricing", "/search", "/guidelines", "/sign-in", "/sign-up"].map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
  }));

  return [
    ...stat,
    ...universities.map((u) => ({ url: `${base}/university/${u.id}`, lastModified: u.updatedAt })),
    ...coaches.map((c) => ({ url: `${base}/coach/${c.id}`, lastModified: c.updatedAt })),
    ...dorms.map((d) => ({ url: `${base}/dorm/${d.id}`, lastModified: d.updatedAt })),
  ];
}
