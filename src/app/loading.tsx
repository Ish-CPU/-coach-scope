export default function Loading() {
  return (
    <div className="container-page py-20">
      <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/3 animate-pulse bg-brand-600" />
      </div>
      <div className="mt-3 text-center text-xs uppercase tracking-wider text-slate-400">
        Loading…
      </div>
    </div>
  );
}
