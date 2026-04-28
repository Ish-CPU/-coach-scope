import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canParticipateInGroup,
  describeGate,
  getSession,
  whyCannotParticipate,
} from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import type { PostSort } from "@/lib/groups";

const schema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(10000),
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
  if (!canParticipateInGroup(session, group.groupType)) {
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

  const post = await prisma.groupPost.create({
    data: {
      groupId: group.id,
      authorId: session!.user.id,
      title: parsed.data.title,
      body: parsed.data.body,
    },
  });

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

  const group = await prisma.group.findUnique({ where: { slug: params.slug } });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const orderBy =
    sort === "new"
      ? { createdAt: "desc" as const }
      : sort === "comments"
      ? { commentCount: "desc" as const }
      : sort === "controversial"
      ? { downvoteCount: "desc" as const }
      : { totalScore: "desc" as const };

  const posts = await prisma.groupPost.findMany({
    where: { groupId: group.id, status: "PUBLISHED" },
    orderBy,
    take: 50,
    include: {
      author: { select: { id: true, role: true, verificationStatus: true } },
    },
  });

  return NextResponse.json({ posts });
}
