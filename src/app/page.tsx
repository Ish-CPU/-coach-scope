import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { AdSlot } from "@/components/AdSlot";
import { ResultCard } from "@/components/ResultCard";
import { runSearch } from "@/lib/search";
import { safe } from "@/lib/safe-query";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // runSearch already returns [] on per-query failure, but wrap defensively
  // so the homepage never bubbles a DB error to the global error boundary.
  const trending = await safe(
    () => runSearch({ kind: "all", limit: 6 }),
    [],
    "home:trending"
  );

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="container-page py-16 sm:py-24 text-center">
          <span className="badge bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20">
            Built for transparency
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            University Verified — honest reviews of universities, programs &amp; campus life.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Students, athletes, alumni, and parents share what university
            decisions <em>actually</em> look like — so the next person doesn't have
            to guess.
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBar size="lg" />
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Try “Stanford baseball”, “Wilbur Hall”, or a head coach's name.
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
            <Link href="/search?kind=coach" className="rounded-full bg-white px-4 py-1.5 shadow-soft hover:bg-slate-50">
              🧑‍🏫 Coaches
            </Link>
            <Link href="/search?kind=university" className="rounded-full bg-white px-4 py-1.5 shadow-soft hover:bg-slate-50">
              🎓 Universities
            </Link>
            <Link href="/search?kind=dorm" className="rounded-full bg-white px-4 py-1.5 shadow-soft hover:bg-slate-50">
              🏠 Dorms
            </Link>
            <Link href="/search?reviewType=PARENT_INSIGHT" className="rounded-full bg-white px-4 py-1.5 shadow-soft hover:bg-slate-50">
              👨‍👩‍👦 Parent insights
            </Link>
            <Link href="/groups" className="rounded-full bg-white px-4 py-1.5 shadow-soft hover:bg-slate-50">
              💬 Verified Groups
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page py-10">
        <AdSlot variant="banner" />
      </section>

      <section className="container-page py-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-bold text-slate-900">Trending on University Verified</h2>
          <Link href="/search" className="text-sm text-brand-700 hover:underline">
            See all results →
          </Link>
        </div>
        <div className="grid gap-3">
          {trending.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-500">
              <p className="font-medium text-slate-700">No results yet.</p>
              <p className="mt-1">Data will appear here soon.</p>
            </div>
          ) : (
            trending.map((h) => <ResultCard key={`${h.type}:${h.id}`} hit={h} />)
          )}
        </div>
      </section>

      <section className="container-page grid gap-6 py-12 sm:grid-cols-3">
        {[
          { t: "1. Browse for free", d: "Anyone can search and read every review without an account." },
          { t: "2. Become a Verified Member", d: "Subscribe to post reviews, save favorites, and vote on what's helpful." },
          { t: "3. Get Athlete-verified", d: "Add your .edu email or roster link for prioritized, weighted reviews." },
        ].map((c) => (
          <div key={c.t} className="card p-5">
            <h3 className="text-base font-semibold text-slate-900">{c.t}</h3>
            <p className="mt-2 text-sm text-slate-600">{c.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
