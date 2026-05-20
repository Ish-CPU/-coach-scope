"use client";

/**
 * Reusable file picker → Vercel Blob upload → URL field.
 *
 * Drop-in replacement for `<input type="url" />` in any form that
 * previously asked users to "paste a link to a hosted image". Same
 * binding shape (value: string URL, onChange: (url: string) => void),
 * so existing form state machines work without changes — they just
 * see a URL instead of needing the user to paste one.
 *
 * Flow:
 *   1. User picks a file via <input type="file">
 *   2. Component immediately POSTs it to /api/upload as multipart/form-data
 *   3. On success, the returned blob URL is fed back via `onChange`
 *   4. Parent form's `value` updates → submit button enables → form
 *      submits the URL exactly as if the user had pasted it manually
 *
 * Visuals match the rest of the verification UI (slate borders,
 * brand-50 highlight). Picker UI degrades to "Choose file" if nothing
 * is selected, then shows the filename + a "Remove" button once picked.
 */
import { useRef, useState } from "react";
import { UPLOAD_ACCEPT_ATTR } from "@/lib/blob-upload";

export interface FileUploadFieldProps {
  /**
   * Current URL value (mirrors the prior <input type="url"> binding).
   * Empty string means "no upload yet".
   */
  value: string;
  /** Called with the new URL after a successful upload, or "" on remove. */
  onChange: (url: string) => void;
  /**
   * Bucket the upload should go to. Backend allowlist enforces this
   * value matches one of the known kinds (see /api/upload).
   */
  kind: "verification" | "connection";
  /** Visible label above the field. */
  label: string;
  /** Optional helper copy below the picker. */
  help?: string;
  /** Mark the field as required (driven by parent form validation). */
  required?: boolean;
  /** Disable the picker (e.g. while the parent form is submitting). */
  disabled?: boolean;
}

export function FileUploadField({
  value,
  onChange,
  kind,
  label,
  help,
  required,
  disabled,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // We track the picked filename locally so the UI can show
  // "uploaded: ID_card.jpg" without depending on the URL string.
  const [filename, setFilename] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Upload failed.");
        return;
      }
      if (typeof json.url !== "string") {
        setError("Upload response missing URL.");
        return;
      }
      setFilename(file.name);
      onChange(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    onChange("");
    setFilename(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>

      {value ? (
        // After a successful upload — show what's attached + a remove button.
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-900">
          <span aria-hidden>📎</span>
          <span className="flex-1 truncate">
            {filename ?? "Uploaded"} — ready to submit
          </span>
          <button
            type="button"
            onClick={clear}
            disabled={disabled || uploading}
            className="rounded-md px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_ACCEPT_ATTR}
            required={required && !value}
            disabled={disabled || uploading}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) handleFile(f);
            }}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700 disabled:opacity-60"
          />
          {uploading && (
            <p className="mt-1 text-xs text-slate-500">Uploading…</p>
          )}
        </>
      )}

      {help && !error && (
        <p className="mt-1 text-xs text-slate-500">{help}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}
