import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { canManageGroupModerators } from "@/lib/groups-moderation";
import { createNotification } from "@/lib/notifications-inapp";
import { rateLimit } from "@/lib/rate-limit";
import { GroupMembershipRole, NotificationType } from "@prisma/client";

/**
 * GET  /api/groups/[slug]/moderators
 *   → returns the moderators + admins of the group (sidebar / admin UI)
 *
 * POST /api/groups/[slug]/moderators
 *   { userId, role: "MODERATOR" | "MEMBER" | "ADMIN" }
 *   → set a user's role on this group. Master/staff admins can target
 *     any user; group ADMINs (creators) can promote/demote within their
 *     group. We refuse to demote the last ADMIN so the group always has
 *     at least one owner.
 */
const postSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(GroupMembershipRole),
});

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const group = await prisma.group.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const moderators = await prisma.groupMembership.findMany({
    where: {
      groupId: group.id,
      OR: [
        { role: { in: [GroupMembershipRole.MODERATOR, GroupMembershipRole.ADMIN] } },
        { isAdmin: true },
      ],
    },
    orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
    select: {
      role: true,
      isAdmin: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({ moderators });
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Permission check below is the real gate; this just slows runaway scripts.
  const limited = rateLimit(req, "group:moderators:set", {
    max: 30,
    windowMs: 60_000,
    identifier: session.user.id,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { userId, role } = parsed.data;

  const group = await prisma.group.findUnique({
    where: { slug: params.slug },
    select: { id: true, name: true, slug: true },
  });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  if (!(await canManageGroupModerators(session, group.id))) {
    return NextResponse.json(
      { error: "Forbidden — only group admins (and platform admins) can set moderators." },
      { status: 403 }
    );
  }

  // Last-admin protection: refuse to demote the only ADMIN of a group.
  if (role !== GroupMembershipRole.ADMIN) {
    const adminCount = await prisma.groupMembership.count({
      where: {
        groupId: group.id,
        OR: [{ role: GroupMembershipRole.ADMIN }, { isAdmin: true }],
      },
    });
    const target = await prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId, groupId: group.id } },
      select: { role: true, isAdmin: true },
    });
    const targetIsAdmin =
      target?.role === GroupMembershipRole.ADMIN || target?.isAdmin === true;
    if (adminCount <= 1 && targetIsAdmin) {
      return NextResponse.json(
        {
          error:
            "Can't demote the last group admin — promote another admin first.",
        },
        { status: 400 }
      );
    }
  }

  // Upsert the membership row. New mods/admins join automatically; the
  // `role` change handles existing members.
  await prisma.groupMembership.upsert({
    where: { userId_groupId: { userId, groupId: group.id } },
    create: {
      userId,
      groupId: group.id,
      role,
      isAdmin: role === GroupMembershipRole.ADMIN,
    },
    update: {
      role,
      // Mirror the legacy boolean so older read paths stay consistent.
      isAdmin: role === GroupMembershipRole.ADMIN,
    },
  });

  void createNotification({
    userId,
    actorId: session.user.id,
    type: NotificationType.MOD_ACTION,
    subjectType: "Group",
    subjectId: group.id,
    data: {
      groupSlug: group.slug,
      groupName: group.name,
      actionLabel: `set your role to ${role.toLowerCase()}`,
    },
  });

  return NextResponse.json({ ok: true, role });
}
