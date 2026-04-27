import { GroupType } from "@prisma/client";

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  ATHLETE_GROUP: "Athlete Groups",
  STUDENT_GROUP: "Student Groups",
  PARENT_GROUP: "Parent Groups",
};

export const GROUP_TYPE_DESCRIPTIONS: Record<GroupType, string> = {
  ATHLETE_GROUP: "Verified athletes only — recruiting, NIL, training, transfer portal.",
  STUDENT_GROUP: "Verified students only — campus life, dorms, food, academics.",
  PARENT_GROUP: "Verified parents only — recruiting questions and family experience.",
};

export type PostSort = "top" | "new" | "comments" | "controversial";
export const POST_SORTS: { value: PostSort; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "comments", label: "Most Commented" },
  { value: "controversial", label: "Controversial" },
];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64) || `g-${Math.random().toString(36).slice(2, 8)}`;
}
