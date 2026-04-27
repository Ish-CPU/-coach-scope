import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canParticipateInGroup,
  describeGate,
  getSession,
  whyCannotParticipate,
} from "@/lib/permissions";

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

  if (!canParticipateInGroup(session, post.group.groupType)) {
    return NextResponse.json(
      { error: describeGate("wrong-role", { groupType: post.group.groupType }) },
      { status: 403 }
    );
  }

  await prisma.$transaction([
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

  return NextResponse.json({ ok: true }, { status: 201 });
}
