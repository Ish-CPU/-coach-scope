import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { assertProductionEnv } from "@/lib/env";

// Boot-time env validation. Runs once per server process. In production this
// throws on the first request if a required var is missing, surfacing the
// misconfiguration immediately instead of letting downstream features fail
// one by one (Stripe in checkout, NextAuth in sign-in, etc.).
assertProductionEnv();

// Brand metadata. Public name is "MyUniversityVerified" in all visible
// copy. "UV" is the only acceptable short form and is reserved for the
// logo mark — never used in prose. Production domain:
// https://myuniversityverified.com
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://myuniversityverified.com"
  ),
  title: {
    default:
      "MyUniversityVerified — Verified reviews of universities, programs & campus life",
    template: "%s · MyUniversityVerified",
  },
  description:
    "A verified review and transparency platform for universities, students, athletes, alumni, and campus life.",
  applicationName: "MyUniversityVerified",
  openGraph: {
    type: "website",
    siteName: "MyUniversityVerified",
    title:
      "MyUniversityVerified — Verified reviews of universities, programs & campus life",
    description:
      "A verified review and transparency platform for universities, students, athletes, alumni, and campus life.",
    url: "https://myuniversityverified.com",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "MyUniversityVerified — Verified reviews of universities, programs & campus life",
    description:
      "A verified review and transparency platform for universities, students, athletes, alumni, and campus life.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
