import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-slate-600">We couldn't find that page.</p>
      <Link href="/" className="btn-primary mt-6">Go home</Link>
    </div>
  );
}
