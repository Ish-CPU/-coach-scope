"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GroupType, LifecycleAudience } from "@prisma/client";
import { GROUP_TYPE_LABELS } from "@/lib/groups";

const LIFECYCLE_OPTIONS: {
  value: LifecycleAudience;
  label: string;
  hint: string;
}[] = [
  {
    value: LifecycleAudience.CURRENT_AND_ALUMNI,
    label: "Current + alumni",
    hint:
      "Default. Both current members and alumni in the relevant role bucket can view and post.",
  },
  {
    value: LifecycleAudience.CURRENT_ONLY,
    label: "Current only",
    hint:
      "Active-roster room. Alumni cannot view or post. Good for live team chat.",
  },
  {
    value: LifecycleAudience.ALUMNI_ONLY,
    label: "Alumni only",
    hint:
      "Alumni mentorship / transfer portal rooms. Current members cannot view or post.",
  },
];

export function CreateGroupForm({ fixedType }: { fixedType?: GroupType }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupType, setGroupType] = useState<GroupType>(
    fixedType ?? GroupType.ATHLETE_GROUP
  );
  // Default mirrors the schema default so submitting without changing the
  // selector matches the legacy behavior (no lifecycle gate).
  const [lifecycleAudience, setLifecycleAudience] = useState<LifecycleAudience>(
    LifecycleAudience.CURRENT_AND_ALUMNI
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        groupType,
        lifecycleAudience,
      }),
    });
    setSubmitting(false);
    const j = await res.json();
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Could not create group.");
      return;
    }
    router.push(`/groups/${j.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4">
      <div>
        <label className="label">Name</label>
        <input
          className="input"
          required
          minLength={3}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Big Ten Baseball Recruits"
        />
      </div>
      <div>
        <label className="label">Audience</label>
        {fixedType ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            {GROUP_TYPE_LABELS[fixedType]}
          </div>
        ) : (
          <select
            className="input"
            value={groupType}
            onChange={(e) => setGroupType(e.target.value as GroupType)}
          >
            {(Object.keys(GROUP_TYPE_LABELS) as GroupType[]).map((t) => (
              <option key={t} value={t}>{GROUP_TYPE_LABELS[t]}</option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className="label">Lifecycle audience</label>
        <select
          className="input"
          value={lifecycleAudience}
          onChange={(e) =>
            setLifecycleAudience(e.target.value as LifecycleAudience)
          }
        >
          {LIFECYCLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {LIFECYCLE_OPTIONS.find((o) => o.value === lifecycleAudience)?.hint}
        </p>
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <textarea
          className="input min-h-[100px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </div>
      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <button className="btn-primary" disabled={submitting}>
        {submitting ? "Creating…" : "Create group"}
      </button>
    </form>
  );
}
