import { GroupPostTag } from "@prisma/client";

export const GROUP_POST_TAG_LABELS: Record<GroupPostTag, string> = {
  RECRUITING: "Recruiting",
  TRANSFER_PORTAL: "Transfer Portal",
  NIL: "NIL",
  FACILITIES: "Facilities",
  PLAYING_TIME: "Playing Time",
  TEAM_CULTURE: "Team Culture",
  DORM_LIFE: "Dorm Life",
  PARENT_QUESTION: "Parent Question",
  COACH_QUESTION: "Coach Question",
};

/** Render order for tag pickers / chip rows. */
export const GROUP_POST_TAG_ORDER: GroupPostTag[] = [
  GroupPostTag.RECRUITING,
  GroupPostTag.TRANSFER_PORTAL,
  GroupPostTag.NIL,
  GroupPostTag.PLAYING_TIME,
  GroupPostTag.TEAM_CULTURE,
  GroupPostTag.FACILITIES,
  GroupPostTag.DORM_LIFE,
  GroupPostTag.PARENT_QUESTION,
  GroupPostTag.COACH_QUESTION,
];
