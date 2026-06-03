/* Generates the MyUniversityVerified 30-day marketing plan as a .docx. */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Resolve the globally-installed docx package.
const globalRoot = execSync("npm root -g").toString().trim();
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, Header, Footer, TableOfContents, PageBreak,
} = require(path.join(globalRoot, "docx"));

const BRAND = "1F58E6";
const INK = "0F172A";
const SUBTLE = "64748B";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });
}
function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun(text)],
  });
}
function numbered(text, ref = "numbers") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    children: [new TextRun(text)],
  });
}

// Table helper — header row shaded, body rows plain.
function makeTable(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const headerCells = headers.map((hd, i) =>
    new TableCell({
      borders: cellBorders,
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: BRAND, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: hd, bold: true, color: "FFFFFF" })] })],
    })
  );
  const bodyRows = rows.map((cells) =>
    new TableRow({
      children: cells.map((c, i) =>
        new TableCell({
          borders: cellBorders,
          width: { size: widths[i], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: c.split("\n").map((line) => new Paragraph({ children: [new TextRun(line)] })),
        })
      ),
    })
  );
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...bodyRows],
  });
}

const doc = new Document({
  creator: "MyUniversityVerified",
  title: "MyUniversityVerified — 30-Day Growth Plan",
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: INK } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal",
        run: { size: 56, bold: true, color: BRAND, font: "Arial" },
        paragraph: { spacing: { after: 120 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: BRAND, font: "Arial" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: INK, font: "Arial" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "MyUniversityVerified — Confidential Growth Plan   |   Page ", color: SUBTLE, size: 18 }),
            new TextRun({ children: [PageNumber.CURRENT], color: SUBTLE, size: 18 }),
          ],
        })],
      }),
    },
    children: [
      // ---- Cover ----
      new Paragraph({ spacing: { before: 1200, after: 0 }, style: "Title", children: [new TextRun("MyUniversityVerified")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "30-Day Social Media Growth & Conversion Plan", size: 30, bold: true, color: INK })] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "TikTok + Instagram organic strategy, content calendar, and UI commercial brief", size: 22, color: SUBTLE })] }),
      new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: "Prepared for the founder — athlete-led launch", size: 20, italics: true, color: SUBTLE })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ---- TOC ----
      new Paragraph({ children: [new TextRun({ text: "Contents", bold: true, size: 28, color: BRAND })] }),
      new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
      new Paragraph({ children: [new PageBreak()] }),

      // ---- 1. The Goal & Honest Reframe ----
      h1("1. The Goal — and an Honest Reframe"),
      p("Stated goal: 1,000 people, then 6,000 people, within 30 days. Whether that's realistic depends entirely on whether “people” means free signups or paid subscribers."),
      makeTable(
        ["Metric", "30-day feasibility", "Why"],
        [
          ["6,000 free signups (Other tier + browsers)", "Achievable", "One athlete-POV TikTok that hits can reach 500K+ views."],
          ["6,000 paid subscribers ($5.99/mo)", "Extremely unlikely", "That is ~$36K MRR from a standing start — a rare outlier for any bootstrapped product in month one."],
        ],
        [3200, 2400, 3760]
      ),
      p(""),
      p("The winning approach is a funnel, not a single number:", { bold: true }),
      numbered("Acquire thousands of FREE signups (the Other tier) — they cost nothing and generate content + social proof.", "steps"),
      numbered("Get athletes to leave reviews — this is your content moat and the reason the next person subscribes.", "steps"),
      numbered("Convert a slice (realistically 2–5%) to paid once they hit the “I need to post my own review” moment.", "steps"),
      p("The free Other tier is the top of this funnel. Lead with free; upsell to paid.", { italics: true }),

      // ---- 2. Your Unfair Advantage ----
      h1("2. Your Unfair Advantage: An Athlete With a Network"),
      p("Do not start with cold ads. Start warm. Seed the platform with real reviews from athletes you personally know so it isn't a ghost town when strangers arrive."),
      h2("Week 0 — Warm Seed (before any public content)"),
      bullet("DM 30–50 athletes you know: teammates, opponents, friends on other teams."),
      bullet("Ask each to sign up and leave ONE honest review of a coach, program, or dorm they've experienced."),
      bullet("Target: 50–100 reviews live BEFORE you post a single TikTok."),
      p("This is the single most important step. An empty review site converts no one.", { bold: true }),

      // ---- 3. Content Plan ----
      h1("3. 30-Day Organic Content Plan (TikTok + Instagram, $0 budget)"),
      h2("Content Pillars (rotate these)"),
      makeTable(
        ["Pillar", "Why it converts", "Example hook"],
        [
          ["Founder story", "Athletes trust athletes building for athletes", "“I'm a college athlete and I built the app coaches don't want you to have.”"],
          ["Controversy / relatability", "Drives comments + shares", "“Recruits get lied to on visits. So I built a place to expose it.”"],
          ["Receipts / proof", "Shows the product is real + useful", "Screen-record a real, brutal review (name blurred)."],
          ["Utility", "“This helps me” = signup", "“How to check if a coach is actually toxic before you commit.”"],
          ["POV / skits", "TikTok-native, high reach", "“POV: you're a recruit and the coach was nothing like the visit.”"],
        ],
        [2000, 3360, 4000]
      ),
      p(""),
      h2("Cadence"),
      bullet("Post 1–2x/day on TikTok; repost the best to Instagram Reels (same content, both platforms)."),
      bullet("TikTok is your discovery engine; Instagram is your credibility and retention layer."),
      bullet("First 30 days = volume + iteration. Most posts flop. You're farming for the 1–2 that hit."),
      p(""),
      h2("Week-by-Week"),
      makeTable(
        ["Week", "Theme", "Focus"],
        [
          ["Week 1", "Founder + problem", "Your story; plant the problem (“athletes have no honest place to talk about coaches”). Soft CTA: link in bio → free signup."],
          ["Week 2", "Proof + utility", "Show real anonymized reviews; “how to vet a program” educational content; start the controversy angle in comments."],
          ["Week 3", "Social proof + FOMO", "“X athletes already reviewing”; duet/stitch recruiting stories → “post this on the site”; push the verified-athlete angle."],
          ["Week 4", "Conversion push", "“Why it's free to read but verified to post”; highlight paid value (anonymous but verified); direct CTA to subscribe."],
        ],
        [1300, 2400, 5660]
      ),

      // ---- 4. UI Commercial Brief ----
      h1("4. The UI Commercial — Shot-by-Shot Brief"),
      p("Total length: 20–25 seconds (TikTok / Reels sweet spot). Produce in CapCut (free) using screen recordings of the live site. Vertical 9:16, captions always on."),
      h2("Primary Cut: “The Honest Athlete”"),
      makeTable(
        ["Time", "Visual", "Audio / Text overlay"],
        [
          ["0:00–0:02", "HOOK — your face, fast close-up, gym or dorm background", "“Coaches lie during recruiting. Here's how athletes fight back.”"],
          ["0:02–0:05", "Screen-record: scrolling the search page, university cards flying by", "Text: “Real reviews. Verified athletes only.”"],
          ["0:05–0:09", "Screen-record: tap a coach profile, grade badge + reviews animate in", "Text: “Rate coaches, programs, NIL, dorms, campus life.”"],
          ["0:09–0:13", "Screen-record: the verification flow, “Verified Athlete ✓” badge appears", "“Every reviewer is a verified athlete or student. No fakes.”"],
          ["0:13–0:17", "Screen-record: posting a review as “Anonymous Verified Athlete”", "Text: “Anonymous to the public. Verified behind the scenes.”"],
          ["0:17–0:21", "Montage: 3–4 fast UI shots (dorm page, filters, groups)", "Text: “Know before you commit.”"],
          ["0:21–0:25", "CTA — logo, URL, your face again", "“Free to read. Link in bio. MyUniversityVerified.com”"],
        ],
        [1400, 4000, 3960]
      ),
      p(""),
      h2("Production Notes (all free tools)"),
      bullet("Screen recording: iPhone built-in recorder on the live site, or QuickTime on Mac. Record slow, deliberate scrolls; speed up 1.5–2x in editing."),
      bullet("Editing: CapCut (free). Use auto-captions; layer a rising trending sound at low volume under your voiceover."),
      bullet("The hook is everything: the first 2 seconds decide whether the video lives or dies. Make 5 hook variants for the same body footage and test."),
      bullet("Vertical 9:16, captions on (80% of viewers watch muted)."),
      bullet("Trending audio: pick a sound that's rising, not peaked — check TikTok Creative Center."),
      p(""),
      h2("Make 3 Variants to Test"),
      numbered("“The Honest Athlete” — utility / problem angle (above)."),
      numbered("“Coaches don't want this” — controversy angle, same footage, spicier hook."),
      numbered("“I built this” — founder story, more you on camera, less UI."),
      p("Post all 3 across a week. Double down on whichever earns the most watch-time + saves.", { italics: true }),

      // ---- 5. Conversion Mechanics ----
      h1("5. Conversion Mechanics — Viewers → Subscribers"),
      numbered("Link in bio points straight to /pricing (already the entry point).", "steps"),
      numbered("The free Other tier removes the signup wall: people join free, browse, get hooked, then hit “I want to post MY review” → paywall → subscribe.", "steps"),
      numbered("Referral loop: end every post with “tag a teammate who needs to see their coach's reviews.”", "steps"),
      numbered("Reviews ARE the demo: every juicy anonymized review you post is itself an ad.", "steps"),

      // ---- 6. Priorities ----
      h1("6. Priority Checklist"),
      makeTable(
        ["When", "Action", "Why"],
        [
          ["This week", "Warm-seed 50–100 real reviews from athletes you know", "Empty site = zero conversions. Non-negotiable first step."],
          ["This week", "Produce 3 commercial variants in CapCut", "Gives you content to test which angle converts."],
          ["Days 1–30", "Post 1–2x/day; iterate on what hits", "Volume + iteration is how organic reach is won."],
          ["Ongoing", "Track which video drives the most /pricing visits", "Double down on the winning angle; use UTM links + Vercel analytics."],
        ],
        [1500, 3860, 4000]
      ),
      p(""),
      p("Bottom line: optimize for free signups + reviews first. They build the content moat and the social proof that make paid conversions possible. Traction comes before monetization — not the other way around.", { bold: true }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, "MyUniversityVerified-Growth-Plan.docx");
  fs.writeFileSync(out, buf);
  console.log("WROTE", out);
});
