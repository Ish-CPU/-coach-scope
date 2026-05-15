import { GroupType } from "@prisma/client";

/**
 * Display labels for every group type. The two generations of taxonomy
 * (audience-based + entity-based — see schema.prisma) live side by side
 * here so a single label map covers any group row in the DB.
 */
export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  // --- Entity-based (new) ---
  UNIVERSITY: "University Community",
  PROGRAM: "Athletic Program",
  COACH: "Coach Discussion",
  PARENT: "Parent Community",
  RECRUITING: "Recruiting",
  // --- Audience-based (legacy) ---
  ATHLETE_GROUP: "Athlete Groups",
  STUDENT_GROUP: "Student Groups",
  PARENT_GROUP: "Parent Groups",
};

export const GROUP_TYPE_DESCRIPTIONS: Record<GroupType, string> = {
  UNIVERSITY:
    "General community for students, athletes, and alumni tied to a single university.",
  PROGRAM:
    "Tied to one team / sport at a university — coaches, players, schedule, culture.",
  COACH: "Discussion centered on a specific coach — coaching style, fit, recruiting style.",
  PARENT:
    "Parent-focused discussion for a specific university or program. Parents-of-athletes welcome.",
  RECRUITING:
    "Recruiting experience for a specific program — visits, offers, follow-through.",
  ATHLETE_GROUP: "Verified athletes only — recruiting, NIL, training, transfer portal.",
  STUDENT_GROUP: "Verified students only — campus life, dorms, food, academics.",
  PARENT_GROUP: "Verified parents only — recruiting questions and family experience.",
};

/**
 * Order in which sections render on the /groups landing page. Entity types
 * come first (they're the new spine of the experience). Legacy audience
 * groups fall into a single trailing bucket the page renders under
 * "Audience communities".
 */
export const GROUP_SECTION_ORDER: GroupType[] = [
  GroupType.UNIVERSITY,
  GroupType.PROGRAM,
  GroupType.COACH,
  GroupType.PARENT,
  GroupType.RECRUITING,
];

export const LEGACY_AUDIENCE_TYPES: GroupType[] = [
  GroupType.ATHLETE_GROUP,
  GroupType.STUDENT_GROUP,
  GroupType.PARENT_GROUP,
];

/**
 * Section copy used on the landing page. The "All" tile is composed
 * client-side in /app/groups/page.tsx — this map covers per-section
 * headers + helper copy.
 */
export const GROUP_SECTION_COPY: Record<
  GroupType | "ALL" | "MY" | "TRENDING" | "LEGACY",
  { title: string; sub: string }
> = {
  ALL: {
    title: "All groups",
    sub: "Everything across the platform — search above to narrow.",
  },
  MY: {
    title: "My Groups",
    sub: "Groups you've joined or created.",
  },
  TRENDING: {
    title: "Trending Discussions",
    sub: "Highest-scoring posts across every group in the last 7 days.",
  },
  LEGACY: {
    title: "Audience communities",
    sub: "Older audience-segmented groups still visible to their role.",
  },
  UNIVERSITY: {
    title: "University Communities",
    sub: "One community per university — students, athletes, and alumni discussion.",
  },
  PROGRAM: {
    title: "Athletic Program Groups",
    sub: "Sport-specific discussion tied to a university's program.",
  },
  COACH: {
    title: "Coach Discussion Groups",
    sub: "Discussion centered on individual coaches.",
  },
  PARENT: {
    title: "Parent Groups",
    sub: "Parent-focused discussion for a university or program.",
  },
  RECRUITING: {
    title: "Recruiting Groups",
    sub: "Recruiting experience for a specific program.",
  },
  ATHLETE_GROUP: { title: "Athlete Groups", sub: "" },
  STUDENT_GROUP: { title: "Student Groups", sub: "" },
  PARENT_GROUP: { title: "Parent Groups", sub: "" },
};

export type PostSort = "top" | "new" | "comments" | "controversial" | "hot";
export const POST_SORTS: { value: PostSort; label: string }[] = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "comments", label: "Most Commented" },
  { value: "controversial", label: "Controversial" },
];

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 64) || `g-${Math.random().toString(36).slice(2, 8)}`
  );
}
