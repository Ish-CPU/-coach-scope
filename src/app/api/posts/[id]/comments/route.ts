import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canPostInGroup,
  describeGate,
  getSession,
  whyCannotParticipate,
} from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications-inapp";
import { NotificationType } from "@prisma/client";

const schema = z.object({
  body: z.string().min(1).max(5000),
  parentId: z.string().cuid().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = whyCannotParticipate(session);
  if (gate) {
    return NextResponse.json({ error: describeGate(gate) }, { status: 403 });
  }

  const limited = rateLimit(req, "post:comment", {
    max: 30,
    windowMs: 10 * 60_000,
    identifier: session!.user.id,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const post = await prisma.groupPost.findUnique({
    where: { id: params.id },
    include: { group: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Locked posts reject new comments. Existing comments stay readable.
  if (post.lockedAt) {
    return NextResponse.json(
      {
        error:
          "This post is locked — new comments are disabled by a moderator.",
      },
      { status: 403 }
    );
  }

  // Membership lookup so PRIVATE groups can be commented on by members.
  const membership = await prisma.groupMembership.findUnique({
    where: {
      userId_groupId: { userId: session!.user.id, groupId: post.groupId },
    },
    select: { id: true },
  });
  if (
    !canPostInGroup(session, {
      groupType: post.group.groupType,
      visibility: post.group.visibility,
      isMember: !!membership,
    })
  ) {
    return NextResponse.json(
      { error: describeGate("wrong-role", { groupType: post.group.groupType }) },
      { status: 403 }
    );
  }

  // Resolve the parent comment's author up front so we can fire a
  // REPLY_TO_COMMENT notification when this is a thread reply. Skipped
  // for top-level comments.
  const parent = parsed.data.parentId
    ? await prisma.groupComment.findUnique({
        where: { id: parsed.data.parentId },
        select: { authorId: true },
      })
    : null;

  const [comment] = await prisma.$transaction([
    prisma.groupComment.create({
      data: {
        postId: post.id,
        authorId: session!.user.id,
        body: parsed.data.body,
        parentId: parsed.data.parentId,
      },
    }),
    prisma.groupPost.update({
      where: { id: post.id },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  // Notify the post author for top-level comments (or the parent
  // comment author for thread replies). Both fired so a 3-deep reply
  // pings the comment author AND the post author optionally; for the
  // MVP we keep it scoped — only the direct parent.
  void createNotification({
    userId: parent ? parent.authorId : post.authorId,
    actorId: session!.user.id,
    type: parent
      ? NotificationType.REPLY_TO_COMMENT
      : NotificationType.REPLY_TO_POST,
    subjectType: "GroupPost",
    subjectId: post.id,
    data: {
      title: post.title,
      groupSlug: post.group.slug,
      groupName: post.group.name,
      commentId: comment.id,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
