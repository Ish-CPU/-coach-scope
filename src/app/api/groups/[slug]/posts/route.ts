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
import { safe } from "@/lib/safe-query";
import { isSafeHttpUrl } from "@/lib/safe-url";
import type { PostSort } from "@/lib/groups";
import { GroupPostTag } from "@prisma/client";

const schema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(10000),
  // Optional categorical tags + media URL list. Tags constrained to the
  // canonical enum so unknown values are silently dropped.
  tags: z.array(z.nativeEnum(GroupPostTag)).max(5).optional(),
  mediaUrls: z.array(z.string().url()).max(8).optional(),
});

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const session = await getSession();

  const group = await prisma.group.findUnique({ where: { slug: params.slug } });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // Two-layer check: must be paid+verified, AND must match the audience.
  const gate = whyCannotParticipate(session);
  if (gate) {
    return NextResponse.json({ error: describeGate(gate) }, { status: 403 });
  }
  const membership = await prisma.groupMembership.findUnique({
    where: {
      userId_groupId: { userId: session!.user.id, groupId: group.id },
    },
    select: { id: true },
  });
  if (
    !canPostInGroup(session, {
      groupType: group.groupType,
      visibility: group.visibility,
      accessMode: group.accessMode,
      lifecycleAudience: group.lifecycleAudience,
      isMember: !!membership,
    })
  ) {
    return NextResponse.json(
      { error: describeGate("wrong-role", { groupType: group.groupType }) },
      { status: 403 }
    );
  }

  const limited = rateLimit(req, "group:post:create", {
    max: 10,
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

  // Sanitize media URLs — only keep public http(s) links. Drops any
  // shorteners / data: / file: scheme defensively.
  const mediaUrls = (parsed.data.mediaUrls ?? []).filter((u) => isSafeHttpUrl(u));

  // Create the post and bump the group's cached postCount in one
  // transaction so the landing-page card sort stays accurate without a
  // periodic recompute job.
  const [post] = await prisma.$transaction([
    prisma.groupPost.create({
      data: {
        groupId: group.id,
        authorId: session!.user.id,
        title: parsed.data.title,
        body: parsed.data.body,
        tags: parsed.data.tags ?? [],
        mediaUrls,
      },
    }),
    prisma.group.update({
      where: { id: group.id },
      data: { postCount: { increment: 1 } },
    }),
  ]);

  await prisma.groupMembership.upsert({
    where: { userId_groupId: { userId: session!.user.id, groupId: group.id } },
    update: {},
    create: { userId: session!.user.id, groupId: group.id },
  });

  return NextResponse.json({ id: post.id }, { status: 201 });
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url);
  const sort = (url.searchParams.get("sort") as PostSort) ?? "top";

  const group = await safe(
    () => prisma.group.findUnique({ where: { slug: params.slug } }),
    null,
    "api:group:findUnique"
  );
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // Pinned posts always sort to the top, regardless of the chosen
  // sort. Compose by leading the orderBy array with `isPinned desc`.
  const sortOrderBy =
    sort === "new"
      ? [{ createdAt: "desc" as const }]
      : sort === "comments"
      ? [{ commentCount: "desc" as const }]
      : sort === "controversial"
      ? [{ downvoteCount: "desc" as const }]
      : sort === "hot"
      ? [{ totalScore: "desc" as const }, { createdAt: "desc" as const }]
      : [{ totalScore: "desc" as const }];
  const orderBy = [
    { isPinned: "desc" as const },
    { pinnedAt: "desc" as const },
    ...sortOrderBy,
  ];

  const posts = await safe(
    () =>
      prisma.groupPost.findMany({
        where: { groupId: group.id, status: "PUBLISHED" },
        orderBy,
        take: 50,
        include: {
          author: { select: { id: true, role: true, verificationStatus: true } },
        },
      }),
    [],
    "api:group:posts"
  );

  return NextResponse.json({ posts });
}
