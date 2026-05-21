import Link from "next/link";
import { CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions";

export const metadata = {
  title: "Privacy Policy — MyUniversityVerified",
  description: "How MyUniversityVerified collects, uses, and protects your data.",
};

/**
 * Privacy Policy — PLACEHOLDER CONTENT.
 *
 * Like the Terms of Service, the text below is starter language only
 * and MUST be reviewed by counsel before launch. State-specific
 * disclosures (CCPA/CPRA in California, similar laws elsewhere) and
 * GDPR (if EU users) will likely require additional clauses.
 *
 * See src/lib/legal-versions.ts for the versioning + re-acceptance
 * flow.
 */
export default function PrivacyPage() {
  return (
    <div className="container-page py-10">
      <article className="prose prose-slate mx-auto max-w-3xl">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-slate-500">
          Version {CURRENT_PRIVACY_VERSION} · Last updated {CURRENT_PRIVACY_VERSION}
        </p>

        <h2>1. Information We Collect</h2>
        <p>
          We collect information you provide directly (name, email,
          password, role, profile data, verification materials, and
          User Content) and information collected automatically when
          you use the Service (IP address, device identifiers, log
          data, cookies).
        </p>

        <h2>2. How We Use Information</h2>
        <ul>
          <li>To operate, maintain, and improve the Service;</li>
          <li>To verify user roles and identity, and to detect fraud;</li>
          <li>To send transactional emails (verification codes, account notifications);</li>
          <li>To enforce these Terms and comply with legal obligations;</li>
          <li>To respond to inquiries and provide customer support.</li>
        </ul>

        <h2>3. Verification Materials</h2>
        <p>
          Documents you submit during verification (student IDs, diplomas,
          recruiting materials, etc.) are stored in a private blob store
          and accessible only to (i) the uploader, (ii) admins reviewing
          the submission, and (iii) automated fraud-detection systems. We
          retain these materials only as long as needed to verify your
          account and respond to disputes.
        </p>

        <h2>4. Sharing of Information</h2>
        <p>
          We do not sell your personal information. We share information
          with:
        </p>
        <ul>
          <li>
            <strong>Service providers</strong> strictly necessary to
            operate the Service (hosting, payments, email delivery,
            fraud screening, error tracking), all contractually bound to
            handle data on our behalf.
          </li>
          <li>
            <strong>Advertising partners</strong> (see Section 6) that
            may receive non-identifying technical signals (IP address,
            browser type, cookies) to serve and measure ads. These
            partners do not receive your account credentials or
            verification documents.
          </li>
          <li>
            <strong>Law enforcement or regulators</strong> when required
            by valid legal process, or to protect the rights, property,
            or safety of users or the public.
          </li>
        </ul>

        <h2>5. Cookies &amp; Tracking</h2>
        <p>
          We use cookies for authentication, session management, and
          security. The Service may also use third-party cookies and
          similar technologies (including web beacons and pixels)
          provided by analytics, fraud-screening, and advertising
          partners. See Section 6 below for details on advertising-
          related cookies and how to opt out.
        </p>

        <h2>6. Advertising</h2>
        <p>
          The Service may display advertisements provided by third-party
          ad networks, including Google AdSense. These ad networks may
          use cookies, web beacons, and similar technologies to:
        </p>
        <ul>
          <li>Serve ads relevant to your interests based on prior visits to this site and other sites;</li>
          <li>Measure ad performance and detect invalid traffic;</li>
          <li>Provide reporting to advertisers about the ads they serve.</li>
        </ul>
        <p>
          Google uses cookies (including the DoubleClick cookie) to serve
          ads to you based on your visits to this Service and other sites
          on the Internet. You can opt out of personalized advertising
          by visiting Google&apos;s{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ads Settings
          </a>
          .
        </p>
        <p>
          You can also opt out of third-party vendors&apos; use of cookies
          for personalized advertising by visiting the{" "}
          <a
            href="https://www.aboutads.info/choices/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Digital Advertising Alliance opt-out page
          </a>{" "}
          or the{" "}
          <a
            href="https://www.networkadvertising.org/choices/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Network Advertising Initiative opt-out page
          </a>
          . European users can manage consent through the{" "}
          <a
            href="https://www.youronlinechoices.eu/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Your Online Choices
          </a>{" "}
          tool. Opting out does not mean you will stop seeing ads — it
          means the ads you see may be less relevant to your interests.
        </p>
        <p>
          For more information about how Google uses information from
          sites or apps that use its services, see{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noopener noreferrer"
          >
            How Google uses information from sites or apps that use our services
          </a>
          .
        </p>

        <h2>7. Data Retention</h2>
        <p>
          Account information is retained for as long as your account is
          active and for a reasonable period thereafter for audit, legal,
          and dispute purposes. Published reviews may persist after
          account deletion to preserve the integrity of the platform.
        </p>

        <h2>8. Your Rights</h2>
        <p>
          Depending on your jurisdiction, you may have the right to access,
          correct, delete, or export your personal information. To exercise
          these rights, contact us at{" "}
          <a href="mailto:customersupport@myuniversityverified.com">customersupport@myuniversityverified.com</a>.
        </p>

        <h2>9. Security</h2>
        <p>
          We use industry-standard technical and organizational measures
          to protect your information, including encrypted storage of
          verification documents, hashed passwords, rate-limited APIs,
          and admin audit logging. No system is perfectly secure; we
          encourage you to use a unique, strong password.
        </p>

        <h2>10. Children</h2>
        <p>
          The Service is not directed to children under 13. We do not
          knowingly collect personal information from children under 13.
          If you believe we have collected such information, contact us
          and we will delete it promptly.
        </p>

        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy. Material changes will require
          you to re-accept the updated policy before continuing to use
          the Service.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions about privacy? Contact us at{" "}
          <a href="mailto:customersupport@myuniversityverified.com">customersupport@myuniversityverified.com</a>.
        </p>

        <hr />
        <p className="text-xs text-slate-500">
          See also our{" "}
          <Link href="/legal/terms" className="underline">
            Terms of Service
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
