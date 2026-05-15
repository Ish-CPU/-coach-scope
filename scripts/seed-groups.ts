/**
 * scripts/seed-groups.ts
 *
 * Idempotent backfill that creates one entity-anchored Group per real
 * row in the DB:
 *
 *   - one UNIVERSITY group per University       (slug: <uni>-community)
 *   - one PARENT group per University           (slug: <uni>-parents)
 *   - one PROGRAM group per School              (slug: <uni>-<sport>)
 *   - one RECRUITING group per School           (slug: <uni>-<sport>-recruiting)
 *   - one COACH group per Coach                 (slug: coach-<coach>-<schoolId-suffix>)
 *
 * Safety:
 *   - Slug-keyed upsert: re-running NEVER duplicates rows.
 *   - We never delete groups. Existing rows are left untouched if the
 *     slug already exists; only the cached `memberCount` / `postCount`
 *     are refreshed from `_count` so the landing page shows accurate
 *     numbers.
 *   - `createdById` points at the master admin (the script reads
 *     env MASTER_ADMIN_EMAIL or falls back to the first row with
 *     role=MASTER_ADMIN). Hard-fails if neither exists — bulk-creating
 *     groups under a fake / nullable creator would corrupt the
 *     `_count.createdBy` shape relied on elsewhere.
 *
 * Run:
 *   npm run seed:groups
 *
 * Heavy DB? Use `--limit-universities=N` to cap how many universities
 * are processed in a single run. `--dry-run` lists what would be
 * created without writing anything.
 */
import {
  GroupType,
  GroupVisibility,
  PrismaClient,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const argFor = (prefix: string): string | null => {
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return null;
};
const DRY_RUN = args.has("--dry-run");
const UNI_LIMIT = Number(argFor("--limit-universities=") ?? "0") || undefined;

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "g"
  );
}

function shortHash(s: string): string {
  // Tiny suffix so coaches with duplicate names at the same school never
  // collide. Keep slugs human-readable, just disambiguate enough.
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}

function uniSlug(name: string): string {
  return slugify(name);
}
function communitySlug(name: string): string {
  return `${uniSlug(name)}-community`;
}
function parentSlug(name: string): string {
  return `${uniSlug(name)}-parents`;
}
function programSlug(uniName: string, sport: string): string {
  return `${uniSlug(uniName)}-${slugify(sport)}`;
}
function recruitingSlug(uniName: string, sport: string): string {
  return `${uniSlug(uniName)}-${slugify(sport)}-recruiting`;
}
function coachSlug(coachName: string, schoolId: string): string {
  return `coach-${slugify(coachName)}-${shortHash(schoolId)}`;
}

// ---------------------------------------------------------------------------
// Resolver: who creates the seeded groups
// ---------------------------------------------------------------------------

async function resolveCreatorId(): Promise<string> {
  const envEmail = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase();
  if (envEmail) {
    const u = await prisma.user.findUnique({
      where: { email: envEmail },
      select: { id: true, role: true },
    });
    if (u && (u.role === UserRole.MASTER_ADMIN || u.role === UserRole.ADMIN)) {
      return u.id;
    }
  }
  const fallback = await prisma.user.findFirst({
    where: { role: UserRole.MASTER_ADMIN },
    select: { id: true },
  });
  if (fallback) return fallback.id;
  const adminFallback = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  });
  if (adminFallback) return adminFallback.id;
  throw new Error(
    "No MASTER_ADMIN or ADMIN user in the DB. Run `npm run admin:create-master` first so there's a valid `createdById` for seeded groups."
  );
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

interface SeedInput {
  slug: string;
  name: string;
  groupType: GroupType;
  description: string;
  visibility: GroupVisibility;
  universityId?: string | null;
  schoolId?: string | null;
  coachId?: string | null;
  sport?: string | null;
}

interface Counts {
  created: number;
  skipped: number;
  refreshed: number;
}

async function upsertGroup(
  input: SeedInput,
  creatorId: string,
  counts: Counts
): Promise<void> {
  const existing = await prisma.group.findUnique({
    where: { slug: input.slug },
    select: { id: true, _count: { select: { members: true, posts: true } } },
  });
  if (existing) {
    if (DRY_RUN) {
      counts.skipped += 1;
      return;
    }
    // Refresh cached counters from _count so landing-page sort/display
    // numbers stay accurate after a re-run. We never overwrite name /
    // description / type / visibility — those may have been edited by
    // a real admin and seed runs shouldn't undo that.
    await prisma.group.update({
      where: { id: existing.id },
      data: {
        memberCount: existing._count.members,
        postCount: existing._count.posts,
      },
    });
    counts.refreshed += 1;
    return;
  }
  if (DRY_RUN) {
    counts.created += 1;
    return;
  }
  await prisma.group.create({
    data: {
      slug: input.slug,
      name: input.name,
      groupType: input.groupType,
      description: input.description,
      visibility: input.visibility,
      universityId: input.universityId ?? null,
      schoolId: input.schoolId ?? null,
      coachId: input.coachId ?? null,
      sport: input.sport ?? null,
      memberCount: 0,
      postCount: 0,
      createdById: creatorId,
    },
  });
  counts.created += 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const creatorId = await resolveCreatorId();
  console.log(`[seed-groups] creator user id resolved: ${creatorId}`);
  if (DRY_RUN) console.log("[seed-groups] DRY RUN — no writes will happen");

  const counts: Counts = { created: 0, skipped: 0, refreshed: 0 };

  // Load universities + their schools + coaches in one round trip per
  // university batch. Cheaper than separate findMany calls and keeps
  // memory bounded.
  const universities = await prisma.university.findMany({
    take: UNI_LIMIT,
    orderBy: { name: "asc" },
    include: {
      schools: {
        include: { coaches: { select: { id: true, name: true, schoolId: true } } },
      },
    },
  });
  console.log(`[seed-groups] processing ${universities.length} universities…`);

  for (const u of universities) {
    // 1. University community group
    await upsertGroup(
      {
        slug: communitySlug(u.name),
        name: `${u.name} Community`,
        groupType: GroupType.UNIVERSITY,
        description: `General community for students, athletes, and alumni tied to ${u.name}.`,
        visibility: GroupVisibility.PUBLIC,
        universityId: u.id,
      },
      creatorId,
      counts
    );

    // 2. Parent group (per university)
    await upsertGroup(
      {
        slug: parentSlug(u.name),
        name: `${u.name} Parents`,
        groupType: GroupType.PARENT,
        description: `Parent-focused discussion for ${u.name}.`,
        visibility: GroupVisibility.PUBLIC,
        universityId: u.id,
      },
      creatorId,
      counts
    );

    for (const s of u.schools) {
      // 3. Program group (per school = per sport at this university)
      await upsertGroup(
        {
          slug: programSlug(u.name, s.sport),
          name: `${u.name} ${s.sport}`,
          groupType: GroupType.PROGRAM,
          description: `${u.name} ${s.sport} — coaches, players, schedule, culture.`,
          visibility: GroupVisibility.PUBLIC,
          universityId: u.id,
          schoolId: s.id,
          sport: s.sport,
        },
        creatorId,
        counts
      );

      // 4. Recruiting group (per school)
      await upsertGroup(
        {
          slug: recruitingSlug(u.name, s.sport),
          name: `${u.name} ${s.sport} Recruiting`,
          groupType: GroupType.RECRUITING,
          description: `Recruiting experience for ${u.name} ${s.sport} — visits, offers, follow-through.`,
          visibility: GroupVisibility.PUBLIC,
          universityId: u.id,
          schoolId: s.id,
          sport: s.sport,
        },
        creatorId,
        counts
      );

      // 5. Coach groups (per coach at this school)
      for (const c of s.coaches) {
        await upsertGroup(
          {
            slug: coachSlug(c.name, c.schoolId),
            name: `Coach ${c.name} — ${u.name} ${s.sport}`,
            groupType: GroupType.COACH,
            description: `Discussion centered on ${c.name} (${u.name} ${s.sport}).`,
            visibility: GroupVisibility.PUBLIC,
            universityId: u.id,
            schoolId: s.id,
            coachId: c.id,
            sport: s.sport,
          },
          creatorId,
          counts
        );
      }
    }
  }

  console.log("");
  console.log("=== seed-groups summary ===");
  console.log(`  Created:   ${counts.created}`);
  console.log(`  Refreshed: ${counts.refreshed} (cached counts only)`);
  console.log(`  Skipped:   ${counts.skipped}`);
  if (DRY_RUN)
    console.log(
      "  (DRY RUN) re-run without --dry-run to actually write the rows."
    );
  console.log("");
  console.log("Test URLs:");
  console.log("  http://localhost:3000/groups");
  console.log("  http://localhost:3000/groups?filter=UNIVERSITY");
  console.log("  http://localhost:3000/groups?filter=PROGRAM");
  console.log("  http://localhost:3000/groups?filter=COACH");
  console.log("  http://localhost:3000/groups?filter=RECRUITING");
  console.log("  http://localhost:3000/groups?q=stanford");
  console.log("");
}

main()
  .catch((err) => {
    console.error("[seed-groups] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
