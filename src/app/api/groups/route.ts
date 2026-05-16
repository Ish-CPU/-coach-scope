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
import { rateLimit } from "@/lib/rate-limit";
import { safe } from "@/lib/safe-query";
import {
  GroupType,
  GroupVisibility,
  LifecycleAudience,
  UserRole,
} from "@prisma/client";

const schema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(2000).optional(),
  groupType: z.nativeEnum(GroupType),
  universityId: z.string().cuid().optional(),
  schoolId: z.string().cuid().optional(),
  // Entity-typed COACH groups carry a coachId. Optional otherwise.
  coachId: z.string().cuid().optional(),
  // Free text — but we validate against the canonical SPORTS list when present.
  sport: z
    .string()
    .max(60)
    .optional()
    .refine((v) => v === undefined || isAllowedSport(v), {
      message: `Sport must be one of: ${SPORTS.join(", ")}`,
    }),
  // Legacy boolean kept for back-compat. New callers should send
  // `visibility` instead.
  isPrivate: z.boolean().optional().default(false),
  visibility: z.nativeEnum(GroupVisibility).optional(),
  // Lifecycle audience gate. Optional — defaults to CURRENT_AND_ALUMNI
  // at the DB level so legacy create calls keep working unchanged.
  lifecycleAudience: z.nativeEnum(LifecycleAudience).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const groupType = url.searchParams.get("type") as GroupType | null;
  const q = url.searchParams.get("q")?.trim();

  // Search spans name + description + the linked university's name +
  // sport. Hits the public landing page typeahead so users can find
  // "michigan football" by typing either the school or the program.
  const search = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
          { sport: { contains: q, mode: "insensitive" as const } },
          {
            university: { name: { contains: q, mode: "insensitive" as const } },
          },
        ],
      }
    : undefined;

  const groups = await safe(
    () =>
      prisma.group.findMany({
        where: {
          ...(groupType ? { groupType } : {}),
          ...(search ?? {}),
        },
        orderBy: [{ memberCount: "desc" }, { postCount: "desc" }, { createdAt: "desc" }],
        take: 60,
        include: {
          university: { select: { id: true, name: true } },
          school: { select: { id: true, sport: true, division: true } },
          coach: { select: { id: true, name: true } },
          _count: { select: { members: true, posts: true } },
        },
      }),
    [],
    "api:groups:list"
  );

  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = whyCannotParticipate(session);
  if (gate) {
    return NextResponse.json({ error: describeGate(gate) }, { status: 403 });
  }

  // Group creation is heavy + spammable — 5 / hour per user.
  const limited = rateLimit(req, "group:create", {
    max: 5,
    windowMs: 60 * 60_000,
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
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Creation rules:
  //   - Admin / master admin: any group type, any entity link.
  //   - Audience-typed groups (ATHLETE_GROUP / STUDENT_GROUP / PARENT_GROUP):
  //     user can only create their own audience.
  //   - Entity-typed groups (UNIVERSITY / PROGRAM / COACH / PARENT /
  //     RECRUITING): any verified user can create as long as the matching
  //     entity FK is supplied (universityId for UNIVERSITY/PARENT,
  //     schoolId for PROGRAM/RECRUITING, coachId for COACH). The seed
  //     script bulk-creates one per entity, so user creation here is a
  //     fallback for niche cases (regional parent group, etc.).
  if (
    session!.user.role !== UserRole.ADMIN &&
    session!.user.role !== UserRole.MASTER_ADMIN
  ) {
    const audience = groupTypeForRole(session!.user.role);
    const isLegacyAudience =
      data.groupType === GroupType.ATHLETE_GROUP ||
      data.groupType === GroupType.STUDENT_GROUP ||
      data.groupType === GroupType.PARENT_GROUP;
    if (isLegacyAudience) {
      if (!audience || audience !== data.groupType) {
        return NextResponse.json(
          { error: "You can only create audience groups for your own role." },
          { status: 403 }
        );
      }
    } else {
      // Entity-typed — require the matching FK so the row makes sense.
      const needsUni =
        data.groupType === GroupType.UNIVERSITY ||
        data.groupType === GroupType.PARENT;
      const needsSchool =
        data.groupType === GroupType.PROGRAM ||
        data.groupType === GroupType.RECRUITING;
      const needsCoach = data.groupType === GroupType.COACH;
      if (needsUni && !data.universityId) {
        return NextResponse.json(
          { error: "universityId is required for that group type." },
          { status: 400 }
        );
      }
      if (needsSchool && !data.schoolId) {
        return NextResponse.json(
          { error: "schoolId is required for that group type." },
          { status: 400 }
        );
      }
      if (needsCoach && !data.coachId) {
        return NextResponse.json(
          { error: "coachId is required for that group type." },
          { status: 400 }
        );
      }
    }
  }

  // Default visibility: PUBLIC for entity-typed (open communities),
  // VERIFIED_ONLY for legacy audience types (those have always been
  // role-gated). The new `visibility` enum supersedes `isPrivate` but
  // we mirror `isPrivate=true` → PRIVATE so the boolean still works.
  const defaultVisibility =
    data.visibility ??
    (data.isPrivate
      ? GroupVisibility.PRIVATE
      : data.groupType === GroupType.ATHLETE_GROUP ||
        data.groupType === GroupType.STUDENT_GROUP ||
        data.groupType === GroupType.PARENT_GROUP
      ? GroupVisibility.VERIFIED_ONLY
      : GroupVisibility.PUBLIC);

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
      coachId: data.coachId,
      sport: data.sport,
      isPrivate: data.isPrivate,
      visibility: defaultVisibility,
      // Lifecycle audience — `undefined` here means Prisma uses the DB
      // default (CURRENT_AND_ALUMNI), so legacy create calls don't have
      // to know about the new field.
      lifecycleAudience: data.lifecycleAudience,
      // Creator counts as a member, so seed memberCount at 1.
      memberCount: 1,
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
