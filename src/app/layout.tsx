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

export const metadata: Metadata = {
  title: "RateMyU — Honest reviews of college coaches, programs & dorms",
  description:
    "A transparency platform for athletes, parents, and students to rate coaches, athletic programs, universities, and dorm life.",
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
