/**
 * Safe proof URL preview for admin queues.
 *
 * Renders an `<img>` thumbnail when the URL ends in a common image extension,
 * otherwise renders just the link. We intentionally do NOT proxy or cache
 * the file — admins click through to the source for full resolution.
 *
 * The link always opens in a new tab with `noreferrer` so the source can't
 * see we came from the admin panel.
 */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"];

export function ProofPreview({
  url,
  label,
}: {
  url: string | null | undefined;
  label: string;
}) {
  if (!url) return null;

  let isImage = false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    isImage = IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext));
  } catch {
    // Invalid URL — render nothing so we don't leak it as a clickable link.
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {isImage && (
        // Hosted images are admin-eyeballed only. We constrain max size and
        // lazy-load so a queue with 50+ items doesn't slam the network.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          loading="lazy"
          className="max-h-40 max-w-[240px] rounded-lg border border-slate-200 object-contain bg-slate-50"
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-xs text-brand-700 underline break-all"
      >
        {url.length > 80 ? url.slice(0, 80) + "…" : url}
      </a>
    </div>
  );
}
