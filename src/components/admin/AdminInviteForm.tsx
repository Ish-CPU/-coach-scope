"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminPermissions,
  PERMISSION_LABELS,
  AdminPermissionKey,
} from "@/lib/admin-permissions";

interface Props {
  defaultPermissions: AdminPermissions;
}

interface CreateResult {
  id: string;
  email: string;
  inviteUrl?: string;
  temporaryPassword?: string;
}

/**
 * Master-only form: invite a new staff admin. Submits to POST /api/admin/team
 * and on success surfaces either the invite link or the generated temporary
 * password so the master admin can copy + share it out-of-band.
 *
 * Permissions are checkboxes mapped to the AdminPermissions shape; manage-
 * admins is intentionally hidden — only master admins manage other admins.
 */
export function AdminInviteForm({ defaultPermissions }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [perms, setPerms] = useState<AdminPermissions>({ ...defaultPermissions });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          workEmail: workEmail.trim() || undefined,
          mode,
          permissions: perms,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Failed to invite admin.");
        return;
      }
      setResult(json as CreateResult);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  // After a successful create we show the credential (or invite URL) and
  // hide the form. Master admin clicks "Done" to navigate away.
  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">Admin created — share this with them now.</div>
          <p className="mt-1 text-xs">
            We never show this again. If they lose it you'll need to resend the invite
            or reset the password from their detail page.
          </p>
        </div>

        {result.inviteUrl && (
          <div>
            <label className="text-xs font-medium text-slate-600">Invite URL</label>
            <input
              readOnly
              value={result.inviteUrl}
              className="input mt-1 w-full"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
          </div>
        )}
        {result.temporaryPassword && (
          <div>
            <label className="text-xs font-medium text-slate-600">Temporary password</label>
            <input
              readOnly
              value={result.temporaryPassword}
              className="input mt-1 w-full font-mono"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              They'll be forced to set their own password on first login.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push(`/admin/team/${result.id}`)}
          className="btn-primary"
        >
          Open admin profile →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-slate-600">Full name</label>
        <input
          required
          className="input mt-1 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Admin"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Login email</label>
          <input
            required
            type="email"
            className="input mt-1 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@myuniversityverified.com"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">
            Work email <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="email"
            className="input mt-1 w-full"
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder="alex@workplace.com"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600">Onboarding method</label>
        <div className="mt-1 flex gap-2">
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="mode"
              value="invite"
              checked={mode === "invite"}
              onChange={() => setMode("invite")}
            />
            Send invite link
          </label>
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="mode"
              value="password"
              checked={mode === "password"}
              onChange={() => setMode("password")}
            />
            Generate temporary password
          </label>
        </div>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-slate-600">Permissions</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(perms) as AdminPermissionKey[]).map((key) => {
            // canManageAdmins is master-only by hard-coded gate; hide it.
            if (key === "canManageAdmins") return null;
            return (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs"
              >
                <input
                  type="checkbox"
                  checked={perms[key]}
                  onChange={(e) =>
                    setPerms((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span>{PERMISSION_LABELS[key]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "Inviting…" : "Create admin"}
      </button>
    </form>
  );
}
