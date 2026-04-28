import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  describeGate,
  getSession,
  groupTypeForRole,
  whyCannotParticipate,
} from "@/lib/permissions";
import { slugify } from "@/lib/groups";
import { isAllowedSport, SPORTS } from "@/lib/sports";
import { GroupType, UserRole } from "@prisma/client";

const schema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(2000).optional(),
  groupType: z.nativeEnum(GroupType),
  universityId: z.string().cuid().optional(),
  schoolId: z.string().cuid().optional(),
  // Free text — but we validate against the canonical SPORTS list when present.
  sport: z
    .string()
    .max(60)
    .optional()
    .refine((v) => v === undefined || isAllowedSport(v), {
      message: `Sport must be one of: ${SPORTS.join(", ")}`,
    }),
  isPrivate: z.boolean().optional().default(false),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const groupType = url.searchParams.get("type") as GroupType | null;
  const q = url.searchParams.get("q")?.trim();

  const groups = await prisma.group.findMany({
    where: {
      ...(groupType ? { groupType } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      _count: { select: { members: true, posts: true } },
    },
  });

  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
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
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // A user can only create a group of their own audience type.
  if (session!.user.role !== UserRole.ADMIN) {
    const allowed = groupTypeForRole(session!.user.role);
    if (!allowed || allowed !== data.groupType) {
      return NextResponse.json(
        { error: "You can only create groups for your own role." },
        { status: 403 }
      );
    }
  }

  let slug = slugify(data.name);
  let attempt = 0;
  while (await prisma.group.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${slugify(data.name)}-${attempt}`;
    if (attempt > 10) break;
  }

  const group = await prisma.group.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      groupType: data.groupType,
      universityId: data.universityId,
      schoolId: data.schoolId,
      sport: data.sport,
      isPrivate: data.isPrivate,
      createdById: session!.user.id,
      members: {
        create: {
          userId: session!.user.id,
          isAdmin: true,
        },
      },
    },
  });

  return NextResponse.json({ id: group.id, slug: group.slug }, { status: 201 });
}
