import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container-page grid grid-cols-2 gap-6 py-10 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-2">
          <div className="flex items-center gap-2 font-bold">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white text-sm">RU</span>
            <span>RateMyU</span>
          </div>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Honest reviews of college coaches, athletic programs, universities and dorms.
            Reviews are user opinions based on personal experience — not statements of fact.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Browse</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li><Link href="/search?kind=coach">Coaches</Link></li>
            <li><Link href="/search?kind=university">Universities</Link></li>
            <li><Link href="/search?kind=dorm">Dorms</Link></li>
            <li><Link href="/groups">Verified Groups</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Account</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li><Link href="/pricing">Pricing</Link></li>
            <li><Link href="/dashboard">Dashboard</Link></li>
            <li><Link href="/verification">Get verified</Link></li>
            <li><Link href="/guidelines">Community guidelines</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <div className="container-page py-4 text-xs text-slate-500">
          © {new Date().getFullYear()} RateMyU. All reviews are user-generated opinions.
          RateMyU does not verify the accuracy of every claim.
        </div>
      </div>
    </footer>
  );
}
