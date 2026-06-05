/**
 * /dmca — public DMCA intake page.
 *
 * One page, two distinct forms, mode toggle at the top. Visitors land
 * on the takedown form by default (the more common case). Users whose
 * content was removed click "Counter-Notice" to switch.
 *
 * Both forms enforce every statutorily required field. The API at
 * /api/dmca/notice also re-validates on the server — never trust the
 * client.
 *
 * Static page (export const dynamic intentionally omitted so it can
 * benefit from caching). The forms are client components.
 */
import { DmcaForms } from "./DmcaForms";

export const metadata = {
  title: "DMCA — File a Notice",
  description:
    "Submit a DMCA takedown notice or counter-notice to MyUniversityVerified. Designated agent registered with the U.S. Copyright Office.",
};

export default function DmcaPage() {
  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          DMCA Notices
        </h1>
        <p className="mt-2 text-slate-700">
          MyUniversityVerified respects the intellectual property of
          others. If you believe your copyrighted work has been used on
          this site without authorization, file a takedown notice
          below. If you believe content of yours was removed in error,
          file a counter-notice.
        </p>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Read before submitting</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              Submitting a false notice carries{" "}
              <span className="font-semibold">criminal and civil penalties</span>{" "}
              under federal law (17 U.S.C. § 512(f)).
            </li>
            <li>
              We log every submission, including your IP address, and
              forward complete notices to the affected user.
            </li>
            <li>
              For questions or to send a notice by postal mail, our
              registered DMCA agent is on file with the U.S. Copyright
              Office at{" "}
              <a
                href="https://dmca.copyright.gov/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                dmca.copyright.gov
              </a>
              .
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <DmcaForms />
        </div>
      </div>
    </div>
  );
}
