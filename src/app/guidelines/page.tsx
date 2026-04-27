export default function GuidelinesPage() {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Community Guidelines</h1>
        <p className="mt-2 text-sm text-slate-600">
          Coach Scope reviews are user-generated opinions based on personal experience. They are not
          statements of fact. Coach Scope does not independently verify the accuracy of every claim.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Do</h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-700">
          <li>Share your real experience and the specific facts behind your rating.</li>
          <li>Be specific about what worked and what didn't.</li>
          <li>Stick to behavior, communication, and program decisions you witnessed.</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">Don't</h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-700">
          <li>Harass, threaten, or personally attack any individual.</li>
          <li>Post false or unverifiable claims as fact.</li>
          <li>Reveal protected information about minors.</li>
          <li>Post content you wouldn't be willing to stand behind under your real name.</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">Reporting</h2>
        <p className="mt-2 text-sm text-slate-700">
          Use the “Report” button on any review you believe violates these guidelines. Our admin
          team reviews reports and may hide or remove content.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Disclaimer</h2>
        <p className="mt-2 text-sm text-slate-700">
          All ratings are subjective opinions. Coach Scope provides a platform for honest commentary
          and is not responsible for individual user submissions.
        </p>
      </div>
    </div>
  );
}
