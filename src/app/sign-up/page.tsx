"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error?.formErrors?.[0] ?? j.error ?? "Could not create account.");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    router.push("/pricing");
    router.refresh();
  }

  return (
    <div className="container-page flex flex-col items-center justify-center py-16">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Free forever to read. Pick your role on the next step to participate.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <div className="mt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-brand-700 hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
