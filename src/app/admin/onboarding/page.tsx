import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AdminStatus, UserRole } from "@prisma/client";
import { AdminOnboardingForm } from "@/components/admin/AdminOnboardingForm";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function getQuery(sp: PageProps["searchParams"], k: string): string | undefined {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Admin onboarding — runs in two modes.
 *
 *   1. Token redemption (no session). The invite link contains
 *      ?token=…; we look up the user by token, render the form, and
 *      capture password + acceptance.
 *
 *   2. Signed-in mode. An admin who signed in with a temporary password
 *      lands here automatically (forced by the staff layout). They confirm
 *      name + accept rules; password change is optional.
 *
 * On success the API logs them in (NextAuth credentials flow) and they
 * land on /admin.
 */
export default async function AdminOnboardingPage({ searchParams }: PageProps) {
  const token = getQuery(searchParams, "token");
  const session = await getSession();

  // ----- Token redemption path -----
  if (token) {
    const invitee = await prisma.user.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        email: true,
        name: true,
        inviteExpiresAt: true,
        adminStatus: true,
        role: true,
        acceptedAdminRulesAt: true,
      },
    });

    if (
      !invitee ||
      invitee.role !== UserRole.ADMIN ||
      !invitee.inviteExpiresAt ||
      invitee.inviteExpiresAt < new Date()
    ) {
      return (
        <div className="container-page py-16">
          <div className="mx-auto max-w-md card p-6 text-center">
            <h1 className="text-xl font-bold text-slate-900">Invite invalid or expired</h1>
            <p className="mt-2 text-sm text-slate-600">
              Ask a master admin to resend your invite from the Team page.
            </p>
            <Link href="/" className="btn-secondary mt-4 inline-flex">
              Home
            </Link>
          </div>
        </div>
      );
    }

    return (
      <OnboardingFrame email={invitee.email} name={invitee.name ?? ""}>
        <AdminOnboardingForm
          mode="invite"
          token={token}
          email={invitee.email}
          initialName={invitee.name ?? ""}
        />
      </OnboardingFrame>
    );
  }

  // ----- Signed-in path (forced from layout for INVITED admins) -----
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/admin/onboarding");
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      adminStatus: true,
      acceptedAdminRulesAt: true,
      onboardingCompleted: true,
    },
  });

  if (!me || (me.role !== UserRole.ADMIN && me.role !== UserRole.MASTER_ADMIN)) {
    redirect("/");
  }

  // Already onboarded — bounce them to the dashboard. Either signal counts
  // as "done" so legacy rows that pre-date the boolean still pass through
  // without seeing the welcome page on every request.
  if (me.onboardingCompleted || me.acceptedAdminRulesAt) {
    redirect("/admin/dashboard");
  }

  // Master admins onboard once with a streamlined form: name + acceptance
  // only (no password change, no temp-password rotation). Staff admins
  // who signed in with a temporary password get the optional password
  // change toggled on.
  const isMaster = me.role === UserRole.MASTER_ADMIN;

  return (
    <OnboardingFrame
      email={me.email}
      name={me.name ?? ""}
      isMaster={isMaster}
    >
      <AdminOnboardingForm
        mode="session"
        email={me.email}
        initialName={me.name ?? ""}
        // Master admin already has their seeded password — no rotation needed.
        // Staff admins are typically here off a temporary credential and may
        // want to set a permanent one in the same step.
        allowPasswordChange={!isMaster}
      />
    </OnboardingFrame>
  );
}

function OnboardingFrame({
  email,
  name,
  isMaster = false,
  children,
}: {
  email: string;
  name: string;
  isMaster?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isMaster ? "Welcome, master admin" : "Welcome to the admin portal"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isMaster
              ? "One quick acknowledgement before you enter the dashboard. You'll only see this page once."
              : "One quick setup step before you can start moderating."}
          </p>
        </div>

        <div className="card p-3 text-xs text-slate-600">
          Signing in as <span className="font-medium">{name || email}</span>
          {name && <span className="text-slate-400"> ({email})</span>}.
        </div>

        {children}

        <p className="text-[11px] text-slate-400">
          By accepting you agree to act on behalf of users without bias and to keep
          private user data confidential. Master admins can audit your actions.
        </p>
      </div>
    </div>
  );
}
