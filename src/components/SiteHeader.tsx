"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-page flex h-14 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-slate-900"
          aria-label="MyUniversityVerified — home"
        >
          {/* "UV" is the only acceptable short form — used solely as the
              logo mark, per brand spec. On the narrowest screens we render
              the mark alone and drop the wordmark so the header doesn't
              wrap; tablet+ shows the full brand. */}
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white text-sm"
            aria-hidden
          >
            UV
          </span>
          <span className="text-lg hidden sm:inline">MyUniversityVerified</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/search?kind=coach">Coaches</NavLink>
          <NavLink href="/search?kind=university">Universities</NavLink>
          <NavLink href="/search?kind=dorm">Dorms</NavLink>
          <NavLink href="/groups">Groups</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {status === "loading" ? null : session?.user ? (
            <>
              {/* Admin shortcut — only visible to staff/master admins.
                  The /admin route group has its own layout + AdminNav,
                  but without this link admins had to know to type
                  /admin manually (the SiteHeader otherwise has no path
                  into the admin area). Server-side guards still enforce
                  permissions on every /admin/* page; this is purely a
                  discoverability nicety. */}
              {(role === "ADMIN" || role === "MASTER_ADMIN") && (
                <Link
                  href="/admin"
                  className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                  title="Open admin dashboard"
                >
                  Admin
                </Link>
              )}
              <Link href="/dashboard" className="hidden sm:flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
                <span>{session.user.name ?? session.user.email}</span>
                {role && <Badge role={role} compact />}
              </Link>
              <button
                className="btn-ghost text-sm"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="btn-ghost text-sm">Sign in</Link>
              {/* "Get started" routes to /pricing — the canonical entry
                  point. Users pick a tier (paid or free Other) BEFORE
                  creating an account, so the resulting sign-up knows
                  which role to assign + whether to start Stripe checkout. */}
              <Link href="/pricing" className="btn-primary text-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100", className)}
    >
      {children}
    </Link>
  );
}
