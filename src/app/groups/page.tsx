import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import { canParticipate, getSession } from "@/lib/permissions";
import {
  GROUP_SECTION_COPY,
  GROUP_SECTION_ORDER,
  GROUP_TYPE_LABELS,
  LEGACY_AUDIENCE_TYPES,
  groupListOrderBy,
  parseGroupSort,
  type GroupSort,
} from "@/lib/groups";
import { GroupType, GroupVisibility } from "@prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function getQueryParam(sp: PageProps["searchParams"], key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

// Two distinct limits — preview vs deep view. The bug reported in this
// chapter was "filtered View All page only shows 5 cards"; the real fix
// is to make these two cases use different `take` values explicitly so
// it's impossible to accidentally apply the preview cap to the
// drill-down page.
const PREVIEW_LIMIT = 5; // per-section cap on the /groups landing page
const PAGE_SIZE = 50; // per-page cap on /groups?type=… (and ?my=1)
const TRENDING_LIMIT = 6;

// Filter pills surfaced under the search bar. The "All" pill clears
// `?type` entirely; the "My" pill sets `?my=1`. Everything else maps
// 1:1 onto a `GroupType` enum value so the URL contract matches the
// API: /groups?type=UNIVERSITY ↔ GET /api/groups?type=UNIVERSITY.
const TYPE_PILLS: { type: GroupType; label: string }[] = [
  { type: GroupType.UNIVERSITY, label: "Universities" },
  { type: GroupType.PROGRAM, label: "Programs" },
  { type: GroupType.COACH, label: "Coaches" },
  { type: GroupType.PARENT, label: "Parents" },
  { type: GroupType.RECRUITING, label: "Recruiting" },
];

// Single source of truth for "is this string a valid GroupType?". Used
// for tolerant query-param parsing — unknown values fall back to "All".
const VALID_TYPES = new Set<string>(Object.values(GroupType));
function parseTypeParam(raw: string): GroupType | null {
  return raw && VALID_TYPES.has(raw) ? (raw as GroupType) : null;
}

/**
 * Groups landing — organized communities, not a single global feed.
 *
 * URL contract (matches /api/groups so links round-trip cleanly):
 *   /groups                        → "All" view: every section rendered
 *   /groups?type=UNIVERSITY        → only University Communities
 *   /groups?type=PROGRAM           → only Athletic Program Groups
 *   /groups?type=COACH             → only Coach Discussion Groups
 *   /groups?type=PARENT            → only Parent Groups
 *   /groups?type=RECRUITING        → only Recruiting Groups
 *   /groups?my=1                   → only the viewer's joined / created groups
 *   /groups?type=UNIVERSITY&q=…    → filter the active section by search
 *   /groups?q=…                    → search across all sections at once
 *
 * Unknown / typo'd `type` values are silently ignored (treated as "All")
 * rather than crashing — see `parseTypeParam`.
 */
export default async function GroupsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const q = getQueryParam(searchParams, "q").trim();
  const typeParam = getQueryParam(searchParams, "type").toUpperCase();
  const activeType = parseTypeParam(typeParam);
  const myOnly = getQueryParam(searchParams, "my") === "1";

  const userId = session?.user?.id ?? null;
  const showAll = !activeType && !myOnly;

  // Sort order. Default = alpha (A → Z). Trending is opt-in via ?sort=trending
  // so the browse experience is scannable and pagination is stable across
  // pages by default. See src/lib/groups.ts:groupListOrderBy.
  const sort = parseGroupSort(getQueryParam(searchParams, "sort"));

  // Base text-search filter shared by every per-section query.
  const searchClause = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
          { sport: { contains: q, mode: "insensitive" as const } },
          {
            university: {
              name: { contains: q, mode: "insensitive" as const },
            },
          },
          {
            coach: { name: { contains: q, mode: "insensitive" as const } },
          },
        ],
      }
    : {};

  // Pagination — only meaningful on filtered pages (?type= or ?my=1).
  // The landing-page "All" view shows preview-sized chunks per section
  // and never paginates.
  const pageRaw = parseInt(getQueryParam(searchParams, "page"), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const skip = (page - 1) * PAGE_SIZE;

  // Fetch one bucket per entity type. Three modes:
  //   - All-view (showAll): preview each section at PREVIEW_LIMIT (5).
  //     "View all →" link leads to /groups?type=X for the deep view.
  //   - Active type filter: load PAGE_SIZE rows, paginated, plus the
  //     total count for the heading.
  //   - My Groups view: skip these section queries entirely (see
  //     `myGroups` below).
  const sectionQueries = GROUP_SECTION_ORDER.map(async (type) => {
    if (myOnly) {
      return { type, groups: [] as Awaited<ReturnType<typeof loadSection>> };
    }
    if (showAll) {
      return {
        type,
        groups: await loadSection(type, searchClause, PREVIEW_LIMIT, 0, sort),
      };
    }
    if (activeType === type) {
      return {
        type,
        groups: await loadSection(type, searchClause, PAGE_SIZE, skip, sort),
      };
    }
    return { type, groups: [] as Awaited<ReturnType<typeof loadSection>> };
  });
  const sections = await Promise.all(sectionQueries);

  // Total count for the active filter — drives the "N total" heading
  // and the "Next page" disable logic. Only computed when a filter is
  // active so the All view doesn't pay for it.
  const activeTotal =
    activeType
      ? await safe(
          () =>
            prisma.group.count({
              where: { groupType: activeType, ...searchClause },
            }),
          0,
          `groups:count:${activeType}`
        )
      : 0;
  const myTotal =
    myOnly && userId
      ? await safe(
          () =>
            prisma.group.count({
              where: {
                OR: [
                  { members: { some: { userId } } },
                  { createdById: userId },
                ],
              },
            }),
          0,
          "groups:count:my"
        )
      : 0;
  const filteredTotal = activeType ? activeTotal : myOnly ? myTotal : 0;

  // My Groups — joined or created. We never apply the search filter
  // here; "my groups" should show your full list regardless of search.
  // Paginated when ?my=1 is the active view. Honors ?sort= like everything
  // else; default A → Z so a user with many groups can find one by name.
  const myGroups = userId
    ? await safe(
        () =>
          prisma.group.findMany({
            where: {
              OR: [
                { members: { some: { userId } } },
                { createdById: userId },
              ],
            },
            orderBy: groupListOrderBy(sort),
            take: myOnly ? PAGE_SIZE : PREVIEW_LIMIT,
            skip: myOnly ? skip : 0,
            include: groupCardInclude,
          }),
        [],
        "groups:my"
      )
    : [];

  // Trending — top-scoring posts in the last 7 days. Strip only, never
  // a primary feed. Hidden when `?type` or `?my` narrows the view.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const trendingPosts = showAll
    ? await safe(
        () =>
          prisma.groupPost.findMany({
            where: { status: "PUBLISHED", createdAt: { gte: sevenDaysAgo } },
            orderBy: [{ totalScore: "desc" }, { commentCount: "desc" }],
            take: TRENDING_LIMIT,
            select: {
              id: true,
              title: true,
              totalScore: true,
              commentCount: true,
              createdAt: true,
              group: {
                select: {
                  slug: true,
                  name: true,
                  groupType: true,
                  university: { select: { name: true } },
                },
              },
            },
          }),
        [],
        "groups:trending"
      )
    : [];

  // Legacy audience-typed groups. Surfaced only on the "All" view so
  // they don't crowd the focused entity-type slices.
  const legacyGroups = showAll
    ? await safe(
        () =>
          prisma.group.findMany({
            where: {
              groupType: { in: LEGACY_AUDIENCE_TYPES },
              ...searchClause,
            },
            orderBy: groupListOrderBy(sort),
            take: PREVIEW_LIMIT,
            include: groupCardInclude,
          }),
        [],
        "groups:legacy"
      )
    : [];

  // Helper to build the canonical query string for filter pills /
  // "View all" / "Clear filter" links. Pills only ever toggle one
  // dimension at a time — search text is always preserved.
  function buildHref(opts: { type?: GroupType | null; my?: boolean }) {
    const sp = new URLSearchParams();
    if (opts.type) sp.set("type", opts.type);
    if (opts.my) sp.set("my", "1");
    if (q) sp.set("q", q);
    // Preserve the user's chosen sort across filter pill clicks. Omit when
    // alpha — that's the default and the cleaner URL.
    if (sort === "trending") sp.set("sort", sort);
    const qs = sp.toString();
    return qs ? `/groups?${qs}` : "/groups";
  }

  // URL that flips the sort mode while keeping every other filter intact.
  function sortHref(target: GroupSort) {
    const sp = new URLSearchParams();
    if (activeType) sp.set("type", activeType);
    if (myOnly) sp.set("my", "1");
    if (q) sp.set("q", q);
    if (target === "trending") sp.set("sort", target);
    // Note: `page` deliberately dropped — order changes invalidate the
    // current page index.
    const qs = sp.toString();
    return qs ? `/groups?${qs}` : "/groups";
  }

  // Heading copy when a filter is active. Drives the H1 + the
  // "Clear filter" link directly under it.
  const activeHeading = myOnly
    ? GROUP_SECTION_COPY.MY
    : activeType
    ? GROUP_SECTION_COPY[activeType]
    : null;

  // Pagination math for the filtered view.
  const totalPages = filteredTotal > 0 ? Math.ceil(filteredTotal / PAGE_SIZE) : 0;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  function pageHref(target: number) {
    const sp = new URLSearchParams();
    if (activeType) sp.set("type", activeType);
    if (myOnly) sp.set("my", "1");
    if (q) sp.set("q", q);
    // Sort sticks across pagination so order doesn't shuffle mid-browse.
    if (sort === "trending") sp.set("sort", sort);
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `/groups?${qs}` : "/groups";
  }

  return (
    <div className="container-page py-10">
      {/* --- Header --- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {activeHeading ? activeHeading.title : "Verified Groups"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {activeHeading?.sub ||
              "Organized communities by university, program, coach, parents, and recruiting. Pick a community below or search across them."}
          </p>
          {(activeType || myOnly) && (
            <p className="mt-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">
                {filteredTotal.toLocaleString()} total
              </span>
              {q && (
                <span>
                  {" "}· filtered by <span className="text-slate-700">"{q}"</span>
                </span>
              )}
              {totalPages > 1 && (
                <span>
                  {" "}· page {page} of {totalPages}
                </span>
              )}
              <span className="mx-2 text-slate-300">|</span>
              <Link
                href={q ? `/groups?q=${encodeURIComponent(q)}` : "/groups"}
                className="font-medium text-brand-700 hover:underline"
              >
                ← Clear filter
              </Link>
            </p>
          )}
        </div>
        {canParticipate(session) && (
          <Link href="/groups/new" className="btn-primary">
            Create a group
          </Link>
        )}
      </div>

      {/* --- Search + filter --- */}
      <form
        action="/groups"
        method="get"
        className="mt-6 flex flex-wrap items-center gap-2"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search schools, programs, coaches, or groups…"
          className="input flex-1 min-w-[280px]"
          aria-label="Search groups"
        />
        {/* Preserve the active filter + sort when the user re-submits search. */}
        {activeType && <input type="hidden" name="type" value={activeType} />}
        {myOnly && <input type="hidden" name="my" value="1" />}
        {sort === "trending" && (
          <input type="hidden" name="sort" value="trending" />
        )}
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      {/* Sort toggle. Alpha (A → Z) is the default + the highlighted option;
          trending is opt-in. Lives next to the filter pills so the relationship
          between "what's shown" (pills) and "in what order" (sort) is visible
          in one row. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Sort:</span>
        <Link
          href={sortHref("alpha")}
          aria-current={sort === "alpha" ? "page" : undefined}
          className={`rounded-full px-3 py-1 transition ${
            sort === "alpha"
              ? "bg-brand-600 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:border-brand-300"
          }`}
        >
          A → Z
        </Link>
        <Link
          href={sortHref("trending")}
          aria-current={sort === "trending" ? "page" : undefined}
          className={`rounded-full px-3 py-1 transition ${
            sort === "trending"
              ? "bg-brand-600 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:border-brand-300"
          }`}
        >
          Trending
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <FilterPill
          href={buildHref({})}
          active={showAll}
        >
          All
        </FilterPill>
        {TYPE_PILLS.map((p) => (
          <FilterPill
            key={p.type}
            href={buildHref({ type: p.type })}
            active={activeType === p.type}
          >
            {p.label}
          </FilterPill>
        ))}
        <FilterPill
          href={buildHref({ my: true })}
          active={myOnly}
        >
          My Groups
        </FilterPill>
      </div>

      {/* --- My Groups (preview on the All view) --- */}
      {showAll && (
        <Section
          title={GROUP_SECTION_COPY.MY.title}
          sub={GROUP_SECTION_COPY.MY.sub}
          moreHref={userId ? buildHref({ my: true }) : undefined}
        >
          {!userId ? (
            <EmptyCard text="Sign in to see groups you've joined." />
          ) : myGroups.length === 0 ? (
            <EmptyCard text="You haven't joined any groups yet — pick one below." />
          ) : (
            <CardGrid groups={myGroups} session={session} />
          )}
        </Section>
      )}

      {/* --- Trending strip (only on All view) --- */}
      {showAll && trendingPosts.length > 0 && (
        <Section
          title={GROUP_SECTION_COPY.TRENDING.title}
          sub={GROUP_SECTION_COPY.TRENDING.sub}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trendingPosts.map((p) => (
              <Link
                key={p.id}
                href={`/groups/${p.group.slug}/posts/${p.id}`}
                className="card flex flex-col p-4 hover:shadow-card transition"
              >
                <div className="text-[11px] uppercase tracking-wider text-slate-400">
                  {p.group.university?.name ?? GROUP_TYPE_LABELS[p.group.groupType]}
                </div>
                <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                  {p.title}
                </h3>
                <div className="mt-auto pt-2 text-[11px] text-slate-500">
                  in <span className="text-slate-700">{p.group.name}</span> ·{" "}
                  {p.totalScore} pts · {p.commentCount} comments
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* --- My Groups (when ?my=1) --- */}
      {myOnly && userId && (
        <Section
          title={GROUP_SECTION_COPY.MY.title}
          sub={GROUP_SECTION_COPY.MY.sub}
        >
          {myGroups.length === 0 ? (
            <EmptyCard text="You haven't joined any groups yet — pick one below." />
          ) : (
            <>
              <CardGrid groups={myGroups} session={session} />
              {totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  pageHref={pageHref}
                />
              )}
            </>
          )}
        </Section>
      )}

      {/* --- Per-entity-type sections --- */}
      {!myOnly &&
        sections.map(({ type, groups }) => {
          // When a type filter is active, render its section in
          // "deep view" mode: no "View all" link (we ARE the View All
          // page), and pagination controls below the grid.
          if (activeType === type) {
            return (
              <Section
                key={type}
                title={GROUP_SECTION_COPY[type].title}
                sub={GROUP_SECTION_COPY[type].sub}
              >
                {groups.length === 0 ? (
                  <EmptyCard
                    text={
                      q
                        ? `No ${GROUP_TYPE_LABELS[type].toLowerCase()} found for "${q}".`
                        : `No ${GROUP_TYPE_LABELS[type].toLowerCase()} found.`
                    }
                  />
                ) : (
                  <>
                    <CardGrid groups={groups} session={session} />
                    {totalPages > 1 && (
                      <Pagination
                        page={page}
                        totalPages={totalPages}
                        hasPrev={hasPrev}
                        hasNext={hasNext}
                        pageHref={pageHref}
                      />
                    )}
                  </>
                )}
              </Section>
            );
          }
          if (!showAll || groups.length === 0) return null;
          // Landing-page preview: PREVIEW_LIMIT cards + "View all →".
          return (
            <Section
              key={type}
              title={GROUP_SECTION_COPY[type].title}
              sub={GROUP_SECTION_COPY[type].sub}
              moreHref={buildHref({ type })}
            >
              <CardGrid groups={groups} session={session} />
            </Section>
          );
        })}

      {/* --- Legacy audience communities --- */}
      {showAll && legacyGroups.length > 0 && (
        <Section
          title={GROUP_SECTION_COPY.LEGACY.title}
          sub={GROUP_SECTION_COPY.LEGACY.sub}
        >
          <CardGrid groups={legacyGroups} session={session} />
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-section data loader
// ---------------------------------------------------------------------------

const groupCardInclude = {
  university: { select: { id: true, name: true } },
  school: { select: { id: true, sport: true, division: true } },
  coach: { select: { id: true, name: true } },
  posts: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
    select: { id: true, title: true, createdAt: true },
  },
  _count: { select: { members: true, posts: true } },
} as const;

async function loadSection(
  type: GroupType,
  searchClause: Record<string, unknown>,
  take: number,
  skip: number,
  sort: GroupSort
) {
  return safe(
    () =>
      prisma.group.findMany({
        where: { groupType: type, ...searchClause },
        // Default A → Z; trending only when the user explicitly picked it.
        // Secondary `id asc` tiebreaker keeps pagination order stable.
        orderBy: groupListOrderBy(sort),
        take,
        skip,
        include: groupCardInclude,
      }),
    [],
    `groups:section:${type}`
  );
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${
        active
          ? "bg-brand-600 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}

function Section({
  title,
  sub,
  moreHref,
  children,
}: {
  title: string;
  sub: string;
  moreHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
        {moreHref && (
          <Link href={moreHref} className="text-xs font-medium text-brand-700 hover:underline">
            View all →
          </Link>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="card p-6 text-center text-sm text-slate-500">{text}</div>
  );
}

function CardGrid({
  groups,
  session,
}: {
  groups: Array<Awaited<ReturnType<typeof loadSection>>[number]>;
  session: Awaited<ReturnType<typeof getSession>>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} session={session} />
      ))}
    </div>
  );
}

function GroupCard({
  group,
  session,
}: {
  group: Awaited<ReturnType<typeof loadSection>>[number];
  session: Awaited<ReturnType<typeof getSession>>;
}) {
  const latest = group.posts[0];
  const memberCount = group._count.members || group.memberCount;
  const postCount = group._count.posts || group.postCount;
  const visibilityBadge =
    group.visibility === GroupVisibility.PRIVATE
      ? "Private"
      : group.visibility === GroupVisibility.VERIFIED_ONLY
      ? "Verified-only"
      : null;
  void session;
  return (
    <Link
      href={`/groups/${group.slug}`}
      className="card flex flex-col p-4 hover:shadow-card transition"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          {GROUP_TYPE_LABELS[group.groupType]}
        </span>
        {visibilityBadge && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            {visibilityBadge}
          </span>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-base font-semibold text-slate-900">
        {group.name}
      </h3>
      <div className="mt-1 text-xs text-slate-500">
        {group.university?.name && <span>{group.university.name}</span>}
        {group.school?.sport && (
          <>
            {group.university?.name && " · "}
            <span>{group.school.sport}</span>
            {group.school.division && (
              <span className="text-slate-400"> · {group.school.division}</span>
            )}
          </>
        )}
        {group.coach?.name && !group.school && (
          <>
            {group.university?.name && " · "}
            <span>{group.coach.name}</span>
          </>
        )}
      </div>
      {group.description && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
          {group.description}
        </p>
      )}
      {latest && (
        <div className="mt-3 rounded-lg bg-slate-50 p-2 text-[11px]">
          <span className="text-slate-400">Latest:</span>{" "}
          <span className="line-clamp-1 text-slate-700">{latest.title}</span>
        </div>
      )}
      <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {memberCount} members · {postCount} posts
        </span>
        <span className="text-brand-700">View →</span>
      </div>
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
  hasPrev,
  hasNext,
  pageHref,
}: {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  pageHref: (target: number) => string;
}) {
  // Compact "Prev / page X of Y / Next" — enough for the deep view
  // without inventing a number-strip we'd have to maintain. Disabled
  // links render as plain text so they still convey "you're at the end."
  return (
    <nav
      className="mt-4 flex items-center justify-between gap-3 text-xs"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Link
          href={pageHref(page - 1)}
          className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200"
        >
          ← Previous
        </Link>
      ) : (
        <span className="rounded-full bg-slate-50 px-3 py-1 font-medium text-slate-400">
          ← Previous
        </span>
      )}
      <span className="text-slate-500">
        Page <span className="font-medium text-slate-700">{page}</span> of{" "}
        <span className="font-medium text-slate-700">{totalPages}</span>
      </span>
      {hasNext ? (
        <Link
          href={pageHref(page + 1)}
          className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200"
        >
          Next →
        </Link>
      ) : (
        <span className="rounded-full bg-slate-50 px-3 py-1 font-medium text-slate-400">
          Next →
        </span>
      )}
    </nav>
  );
}
