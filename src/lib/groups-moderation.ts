import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import type { Session } from "next-auth";
import {
  GroupAccessMode,
  GroupMembershipRole,
  GroupVisibility,
} from "@prisma/client";

/**
 * Group moderator + access-mode helpers.
 *
 * Two layers:
 *   1. `canModerateGroup(session, groupId)` — server-only check used by
 *      every moderation endpoint (pin, lock, remove, report-action,
 *      assign-moderator). Master + staff admins bypass; otherwise the
 *      user must hold a `GroupMembership` with role MODERATOR or ADMIN
 *      for that exact group.
 *   2. `canManageGroupModerators(session, groupId)` — strict superset:
 *      master/staff admins, or the group ADMIN (i.e. the creator). Used
 *      to gate the assign-moderator endpoint specifically.
 *
 * The legacy `GroupMembership.isAdmin` boolean stays valid — true rows
 * are treated as ADMIN-equivalent for back-compat.
 */
export async function canModerateGroup(
  session: Session | null,
  groupId: string
): Promise<boolean> {
  if (isAdmin(session)) return true;
  const userId = session?.user?.id;
  if (!userId) return false;
  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true, isAdmin: true },
  });
  if (!membership) return false;
  return (
    membership.role === GroupMembershipRole.MODERATOR ||
    membership.role === GroupMembershipRole.ADMIN ||
    membership.isAdmin
  );
}

export async function canManageGroupModerators(
  session: Session | null,
  groupId: string
): Promise<boolean> {
  if (isAdmin(session)) return true;
  const userId = session?.user?.id;
  if (!userId) return false;
  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true, isAdmin: true },
  });
  if (!membership) return false;
  return (
    membership.role === GroupMembershipRole.ADMIN || membership.isAdmin
  );
}

// ---------------------------------------------------------------------------
// Access mode → legacy visibility mapping
// ---------------------------------------------------------------------------
// New rows write `accessMode` directly. Older rows may only have
// `visibility` set; this helper collapses both into a single
// `GroupAccessMode` value the canPostInGroup gate can read uniformly.

export interface AccessShape {
  accessMode?: GroupAccessMode | null;
  visibility?: GroupVisibility | null;
  isPrivate?: boolean | null;
}

export function effectiveAccessMode(input: AccessShape): GroupAccessMode {
  if (input.accessMode) return input.accessMode;
  if (input.isPrivate) return GroupAccessMode.PRIVATE;
  switch (input.visibility) {
    case GroupVisibility.PRIVATE:
      return GroupAccessMode.PRIVATE;
    case GroupVisibility.VERIFIED_ONLY:
      return GroupAccessMode.VERIFIED_ONLY;
    case GroupVisibility.PUBLIC:
    default:
      return GroupAccessMode.PUBLIC_VIEW_PUBLIC_POST;
  }
}
