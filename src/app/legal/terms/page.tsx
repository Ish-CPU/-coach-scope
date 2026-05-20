import Link from "next/link";
import { CURRENT_TERMS_VERSION } from "@/lib/legal-versions";

export const metadata = {
  title: "Terms of Service — MyUniversityVerified",
  description: "Terms governing your use of MyUniversityVerified.",
};

/**
 * Terms of Service — PLACEHOLDER CONTENT.
 *
 * The text below is starter language only. It is NOT legal advice and
 * MUST be reviewed and customized by a qualified attorney before any
 * real users sign up. See src/lib/legal-versions.ts for the versioning
 * + re-acceptance flow that wraps this content.
 *
 * When your lawyer delivers final language, paste it into the JSX
 * body below (or convert to MDX/Markdown source-of-truth) and bump
 * CURRENT_TERMS_VERSION in src/lib/legal-versions.ts. Every existing
 * user gets a forced re-acceptance modal on next sign-in.
 */
export default function TermsPage() {
  return (
    <div className="container-page py-10">
      <article className="prose prose-slate mx-auto max-w-3xl">
        <h1>Terms of Service</h1>
        <p className="text-sm text-slate-500">
          Version {CURRENT_TERMS_VERSION} · Last updated {CURRENT_TERMS_VERSION}
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By creating an account, accessing, or using MyUniversityVerified
          (the &quot;Service&quot;), you agree to be bound by these Terms
          of Service (&quot;Terms&quot;). If you do not agree to all of
          these Terms, do not use the Service.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 13 years old to create an account. If you
          are under 18, you represent that a parent or legal guardian has
          reviewed and agreed to these Terms on your behalf.
        </p>

        <h2>3. User-Generated Content</h2>
        <p>
          You retain ownership of the reviews, ratings, and other content
          you submit (&quot;User Content&quot;). By submitting User Content,
          you grant us a non-exclusive, worldwide, royalty-free license to
          host, store, reproduce, display, and distribute it in connection
          with operating and promoting the Service.
        </p>
        <p>
          You represent and warrant that: (i) you own or have the necessary
          rights to your User Content; (ii) your User Content is truthful
          and reflects your honest, first-hand experience; (iii) your User
          Content does not violate any third party&apos;s rights, including
          rights of privacy, publicity, or intellectual property; and (iv)
          your User Content complies with applicable laws.
        </p>
        <p>
          <strong>
            You — not MyUniversityVerified — bear all responsibility and
            liability for your User Content.
          </strong>{" "}
          MyUniversityVerified is not the author of, and does not endorse,
          any User Content.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Submit reviews of programs, coaches, or institutions with which you have no first-hand experience;</li>
          <li>Defame, harass, threaten, or impersonate any person;</li>
          <li>Submit false, misleading, or fraudulent verification materials;</li>
          <li>Use the Service to violate any law or third party right;</li>
          <li>Scrape, harvest, or otherwise extract data from the Service except via published APIs;</li>
          <li>Circumvent security, rate limits, or moderation systems.</li>
        </ul>

        <h2>5. Verification</h2>
        <p>
          Verification of a user&apos;s role (athlete, student, parent,
          etc.) is based on user-submitted materials and is performed on
          a best-effort basis. Verification is not a guarantee of identity,
          accuracy, or character. We may revoke verification at any time.
        </p>

        <h2>6. Content Moderation</h2>
        <p>
          We may, but are not obligated to, monitor, moderate, edit, or
          remove any User Content at our sole discretion. We are under no
          obligation to act on reports or complaints.
        </p>

        <h2>7. Subscription &amp; Payment</h2>
        <p>
          Certain features require a paid subscription managed through
          Stripe. Fees are non-refundable except where required by law.
          You may cancel at any time; access continues through the end of
          the paid period.
        </p>

        <h2>8. Termination</h2>
        <p>
          We may suspend or terminate your account at our discretion,
          including for violations of these Terms, fraudulent verification,
          or harmful content. You may delete your account at any time;
          published reviews may persist where required to maintain the
          historical integrity of the platform.
        </p>

        <h2>9. Disclaimer of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot;, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
          IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          NON-INFRINGEMENT, ACCURACY OF USER CONTENT, OR UNINTERRUPTED
          AVAILABILITY.
        </p>

        <h2>10. Limitation of Liability</h2>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT
          WILL MYUNIVERSITYVERIFIED OR ITS OFFICERS, EMPLOYEES, OR AGENTS
          BE LIABLE TO YOU FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION
          DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER
          INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR
          ACCESS TO OR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED
          OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL CUMULATIVE
          LIABILITY TO YOU FOR ALL CLAIMS WILL NOT EXCEED THE GREATER OF
          (A) THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING
          THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED US
          DOLLARS ($100).
        </p>

        <h2>11. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless
          MyUniversityVerified, its affiliates, officers, employees, and
          agents from any claims, damages, losses, liabilities, costs, or
          expenses (including reasonable attorneys&apos; fees) arising
          from: (i) your use of the Service; (ii) your User Content; (iii)
          your violation of these Terms; or (iv) your violation of any
          third party&apos;s rights.
        </p>

        <h2>12. Copyright &amp; DMCA</h2>
        <p>
          We respect intellectual property rights. To report a claim of
          copyright infringement under the Digital Millennium Copyright
          Act, contact our Designated Agent with the information
          required by 17 U.S.C. § 512(c)(3). We may remove allegedly
          infringing material and terminate repeat infringers.
        </p>
        <p>
          <strong>Designated Agent:</strong> MJ
          <br />
          <strong>Mailing Address:</strong> PO Box 777872, Henderson, NV 89077
          <br />
          <strong>Email:</strong>{" "}
          <a href="mailto:customersupport@myuniversityverified.com">customersupport@myuniversityverified.com</a>
        </p>

        <h2>13. Modification of Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes
          will require you to re-accept the updated Terms before continuing
          to use the Service. Continued use after acceptance constitutes
          agreement to the revised Terms.
        </p>

        <h2>14. Governing Law &amp; Disputes</h2>
        <p>
          These Terms are governed by the laws of the State of Nevada,
          without regard to its conflict-of-laws principles. Any dispute
          arising from these Terms or the Service shall be resolved by
          binding individual arbitration administered by the American
          Arbitration Association (AAA) under its Commercial Arbitration
          Rules and Consumer Arbitration Rules. Arbitration will be
          conducted in Clark County, Nevada, or — at your election if
          you are a consumer — in the county where you reside. You
          waive any right to participate in a class action, class
          arbitration, or representative proceeding.
        </p>

        <h2>15. Contact</h2>
        <p>
          Questions about these Terms? Contact us at{" "}
          <a href="mailto:customersupport@myuniversityverified.com">customersupport@myuniversityverified.com</a>.
        </p>

        <hr />
        <p className="text-xs text-slate-500">
          See also our{" "}
          <Link href="/legal/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
