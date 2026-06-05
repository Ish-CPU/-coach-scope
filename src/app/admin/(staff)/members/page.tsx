import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus, UserRole, VerificationStatus } from "@prisma/client";
import { MemberRow } from "@/components/admin/MemberRow";

export const dynamic = "force-dynamic";

/**
 * /admin/members — the missing "who are my users?" admin page.
 *
 * Surfaces every non-admin user with role + verification + subscription
 * in one filterable table. Solves the operator gap that left paid
 * customers invisible (their requests don't appear in /admin/verifications
 * unless they actually submitted a verification REQUEST; and there was
 * no other view of paid-but-stuck users).
 *
 * Includes a "Mark verified" action for users you personally vouch for —
 * useful for paying customers who got caught by the old broken
 * verification flow OR who you know in person and just want approved
 * without making them re-submit.
 */
interface PageProps {
  searchParams: Promise<{
    q?: string;
    role?: string;
    verif?: string;
    sub?: string;
    show?: string;
  }>;
}

// Tabs at the top of the page. `paid` is the high-signal default — admins
// usually want to know "who's paying me?" before anything else.
const TABS: { value: string; label: string }[] = [
  { value: "paid", label: "Paying customers" },
  { value: "verified", label: "Verified" },
  { value: "stuck", label: "Paid + unverified" },
  { value: "all", label: "All users" },
  { value: "test", label: "Test accounts" },
];

function parseEnum<T extends string>(
  raw: string | undefined,
  allowed: readonly T[]
): T | null {
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

export default async function AdminMembersPage(props: PageProps) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim();
  const tab = sp.show ?? "paid";
  const role = parseEnum<UserRole>(sp.role, Object.values(UserRole) as UserRole[]);
  const verif = parseEnum<VerificationStatus>(
    sp.verif,
    Object.values(VerificationStatus) as VerificationStatus[]
  );
  const sub = parseEnum<SubscriptionStatus>(
    sp.sub,
    Object.values(SubscriptionStatus) as SubscriptionStatus[]
  );

  // ---- Build the WHERE clause -------------------------------------------
  // The base clause excludes admin accounts (those are managed via
  // /admin/team) and — by default — the seeded test accounts (which would
  // otherwise dominate every list). Switch to the "Test accounts" tab to
  // see them.
  const baseWhere: Parameters<typeof prisma.user.findMany>[0] = {
    where: {
      role: { notIn: [UserRole.ADMIN, UserRole.MASTER_ADMIN] },
      email: tab === "test"
        ? { contains: "coachscope.local" }
        : { not: { contains: "coachscope.local" } },
    },
  };

  // Tab presets stack on top of base filters; explicit filters from the
  // URL still narrow further.
  if (tab === "paid") {
    baseWhere.where = {
      ...baseWhere.where,
      subscriptionStatus: {
        in: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.CANCELED,
        ],
      },
    };
  } else if (tab === "verified") {
    baseWhere.where = {
      ...baseWhere.where,
      verificationStatus: VerificationStatus.VERIFIED,
    };
  } else if (tab === "stuck") {
    // Paid but verification not approved — most likely to need a manual
    // "Mark verified" action from the admin.
    baseWhere.where = {
      ...baseWhere.where,
      subscriptionStatus: {
        in: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.CANCELED,
        ],
      },
      verificationStatus: { not: VerificationStatus.VERIFIED },
    };
  }

  if (q) {
    baseWhere.where = {
      ...baseWhere.where,
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  if (role) {
    baseWhere.where = { ...baseWhere.where, role };
  }
  if (verif) {
    baseWhere.where = { ...baseWhere.where, verificationStatus: verif };
  }
  if (sub) {
    baseWhere.where = { ...baseWhere.where, subscriptionStatus: sub };
  }

  // Pull a wide slice. 500 covers every realistic startup-stage admin
  // view without pagination; we'll add cursor pagination once member
  // count crosses ~2K.
  const users = await prisma.user.findMany({
    ...baseWhere,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      verificationStatus: true,
      subscriptionStatus: true,
      paymentVerified: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
      _count: { select: { verificationRequests: true } },
    },
  });

  // Counts for the tab pills — one cheap groupBy gives us the headline
  // numbers without per-tab roundtrips.
  const all = await prisma.user.count({
    where: {
      role: { notIn: [UserRole.ADMIN, UserRole.MASTER_ADMIN] },
      email: { not: { contains: "coachscope.local" } },
    },
  });
  const paid = await prisma.user.count({
    where: {
      role: { notIn: [UserRole.ADMIN, UserRole.MASTER_ADMIN] },
      email: { not: { contains: "coachscope.local" } },
      subscriptionStatus: {
        in: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.CANCELED,
        ],
      },
    },
  });
  const verified = await prisma.user.count({
    where: {
      role: { notIn: [UserRole.ADMIN, UserRole.MASTER_ADMIN] },
      email: { not: { contains: "coachscope.local" } },
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });
  const stuck = await prisma.user.count({
    where: {
      role: { notIn: [UserRole.ADMIN, UserRole.MASTER_ADMIN] },
      email: { not: { contains: "coachscope.local" } },
      subscriptionStatus: {
        in: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.CANCELED,
        ],
      },
      verificationStatus: { not: VerificationStatus.VERIFIED },
    },
  });
  const test = await prisma.user.count({
    where: {
      role: { notIn: [UserRole.ADMIN, UserRole.MASTER_ADMIN] },
      email: { contains: "coachscope.local" },
    },
  });

  const countMap: Record<string, number> = {
    paid,
    verified,
    stuck,
    all,
    test,
  };

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every signed-up user with their role, verification, and subscription
            in one place. Use the "Mark verified" action for paying customers
            you personally vouch for.
          </p>
        </div>
        <Link
          href="/admin/verifications"
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          See verification queue →
        </Link>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.value;
          const c = countMap[t.value];
          // Preserve the search query when switching tabs but reset role
          // / verif / sub filters (they often conflict across tabs).
          const params = new URLSearchParams();
          params.set("show", t.value);
          if (q) params.set("q", q);
          return (
            <Link
              key={t.value}
              href={`/admin/members?${params.toString()}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
              {typeof c === "number" && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/30 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {c}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <form
        method="get"
        className="mt-4 flex flex-wrap items-center gap-2 text-sm"
      >
        {/* Preserve the active tab across search submits. */}
        <input type="hidden" name="show" value={tab} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search email or name…"
          className="input max-w-xs"
        />
        <button type="submit" className="btn-secondary">
          Search
        </button>
        {q && (
          <Link
            href={`/admin/members?show=${encodeURIComponent(tab)}`}
            className="text-xs text-slate-500 hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Verification</th>
              <th className="px-3 py-2 text-left">Subscription</th>
              <th className="px-3 py-2 text-left">Joined</th>
              <th className="px-3 py-2 text-left">Requests</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                  No users match this filter.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <MemberRow
                  key={u.id}
                  user={{
                    id: u.id,
                    email: u.email,
                    name: u.name,
                    role: u.role,
                    verificationStatus: u.verificationStatus,
                    subscriptionStatus: u.subscriptionStatus,
                    paymentVerified: u.paymentVerified,
                    hasStripeCustomer: Boolean(u.stripeCustomerId),
                    hasStripeSub: Boolean(u.stripeSubscriptionId),
                    createdAt: u.createdAt.toISOString(),
                    submittedRequests: u._count.verificationRequests,
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Showing up to 500 users. Admin + master-admin rows are intentionally
        hidden — manage those at <Link href="/admin/team" className="underline">Team</Link>.
      </p>
    </div>
  );
}
