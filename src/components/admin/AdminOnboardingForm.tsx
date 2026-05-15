"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Props {
  mode: "invite" | "session";
  token?: string;
  email: string;
  initialName: string;
  /** Show the password fields even in session mode. */
  allowPasswordChange?: boolean;
}

/**
 * Two-mode onboarding form.
 *
 *   invite  → token-based; user must set a password and accept rules.
 *             We POST to /api/admin/onboarding with token + new password,
 *             then call signIn() to sign them in with the new credentials.
 *
 *   session → already signed in (e.g. just used a temp password, or a
 *             master admin landing here for the one-time acknowledgement).
 *             Password change is optional. After success we redirect to
 *             /admin/dashboard (the target the API echoes back).
 */
export function AdminOnboardingForm({
  mode,
  token,
  email,
  initialName,
  allowPasswordChange,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPassword = mode === "invite" || allowPasswordChange;
  const passwordRequired = mode === "invite";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("You must accept the admin rules to continue.");
      return;
    }
    if (showPassword && password) {
      if (password.length < 12) {
        setError("Password must be at least 12 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords don't match.");
        return;
      }
    }
    if (passwordRequired && !password) {
      setError("Please set a password.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          token,
          name: name.trim(),
          password: password || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Failed to onboard.");
        return;
      }

      // Invite mode: not signed in yet — sign in with the new password now.
      if (mode === "invite") {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (result?.error) {
          setError("Account set up but sign-in failed. Try the sign-in page directly.");
          return;
        }
      }

      // The API echoes back where to send the user. Defaulting to
      // /admin/dashboard keeps us aligned with the dashboard URL the
      // master admin spec asks for; /admin/dashboard itself just
      // bounces to /admin under the hood.
      const target =
        typeof json.redirectTo === "string" ? json.redirectTo : "/admin/dashboard";
      router.push(target);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-600">Name</label>
        <input
          required
          className="input mt-1 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {showPassword && (
        <>
          <div>
            <label className="text-xs font-medium text-slate-600">
              {passwordRequired ? "Set password" : "New password (optional)"}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="input mt-1 w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={passwordRequired ? 12 : 0}
              required={passwordRequired}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              At least 12 characters. Mix letters, numbers, and a symbol.
            </p>
          </div>
          {password && (
            <div>
              <label className="text-xs font-medium text-slate-600">Confirm password</label>
              <input
                type="password"
                autoComplete="new-password"
                className="input mt-1 w-full"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          )}
        </>
      )}

      <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I understand my admin actions are audited and that I should never share
          access, share private user data, or take action on accounts I have a
          conflict of interest with.
        </span>
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full text-base font-semibold"
      >
        {busy ? "Setting up…" : "Enter Admin Dashboard →"}
      </button>
      <p className="text-center text-[11px] text-slate-400">
        After this you'll land on /admin/dashboard. You won't see this page again.
      </p>
    </form>
  );
}
