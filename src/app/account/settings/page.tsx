import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ManageSubscription } from "@/components/account/ManageSubscription";
import { MyConnectionsCard } from "@/components/dashboard/MyConnectionsCard";
import { RoleChangeCard } from "@/components/account/RoleChangeCard";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { viewFromSubscription } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings" };

/**
 * User-facing account settings page. The product brief calls for the
 * subscription management UI to live in Profile Settings, so this page is
 * the canonical home. Future panels (notification prefs, password,
 * delete account) get added as sibling sections inside the same shell.
 */
export default async function AccountSettingsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/account/settings");
  }

  // Single fresh DB read — never trust session-token mirror fields for
  // billing UI, since they lag the webhook-driven subscription sync.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { subscription: true },
  });

  // Last 10 audit rows for the billing history mini-feed. Cheap because
  // we already have (userId, createdAt) indexed.
  const history = await prisma.subscriptionEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const view = viewFromSubscription(user.subscription);

  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Account settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your subscription and account preferences.
        </p>
      </header>

      <ManageSubscription
        view={view}
        hasStripeCustomer={!!user.stripeCustomerId}
        history={history.map((h) => ({
          id: h.id,
          eventType: h.eventType,
          status: h.status,
          createdAtIso: h.createdAt.toISOString(),
        }))}
      />

      {/* Role-change request flow. Sits above the connections card
          because changing role can invalidate existing connections
          (e.g. an alumni shouldn't have an active CURRENT_ATHLETE
          connection on a roster). Card hides itself for admin accounts;
          locks the form when the user has no active sub or already has
          a pending request. */}
      <div className="mt-8">
        <RoleChangeCard
          userId={user.id}
          currentRole={user.role}
          subscriptionStatus={user.subscriptionStatus}
        />
      </div>

      {/* Compact read-only connections summary. Same component as the
          dashboard card, with `compact` + a smaller cap so it acts as a
          glanceable status indicator rather than a full management UI
          (which lives at /connections). Returns null for roles without a
          connection model so non-athlete/student accounts don't see an
          empty section. */}
      <div className="mt-8">
        <MyConnectionsCard
          userId={user.id}
          role={user.role}
          compact
          limit={3}
        />
      </div>

      {/* Destructive zone. Self-hides for admin / master-admin roles —
          they go through /admin/team for lifecycle changes. The API
          enforces the same gate so this is purely UX. Past-due users
          see a warning + disabled button until they settle; the API
          re-checks live Stripe state as the source of truth. */}
      <DeleteAccountSection
        userRole={user.role}
        subscriptionStatus={user.subscriptionStatus}
      />

      <nav className="mt-10 text-xs text-slate-500">
        <Link href="/dashboard" className="hover:underline">
          ← Back to dashboard
        </Link>
      </nav>
    </div>
  );
}
