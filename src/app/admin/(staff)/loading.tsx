/**
 * Admin loading shell. Shown while a server-rendered admin page
 * resolves its Prisma queries. Keeps the chrome (set by the layout) up
 * so the nav stays clickable while the queue is fetching.
 */
export default function AdminLoading() {
  return (
    <div className="container-page py-10">
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-slate-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-8 w-12 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
