import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  canPostInGroup,
  describeGate,
  getSession,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CreatePostForm } from "@/components/groups/CreatePostForm";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { GROUP_TYPE_LABELS } from "@/lib/groups";

export const dynamic = "force-dynamic";

export default async function NewPostPage({ params }: { params: { slug: string } }) {
  const session = await getSession();
  if (!session?.user) redirect(`/sign-in?callbackUrl=/groups/${params.slug}/new`);

  const group = await prisma.group.findUnique({ where: { slug: params.slug } });
  if (!group) notFound();

  // Membership matters for PRIVATE groups; the new gate consumes it.
  const membership = await prisma.groupMembership.findUnique({
    where: {
      userId_groupId: { userId: session.user.id, groupId: group.id },
    },
    select: { id: true },
  });
  const accessShape = {
    groupType: group.groupType,
    visibility: group.visibility,
    accessMode: group.accessMode,
    lifecycleAudience: group.lifecycleAudience,
    isMember: !!membership,
  };

  if (!canPostInGroup(session, accessShape)) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl space-y-3">
          <UpgradePrompt
            message={describeGate("wrong-role", { groupType: group.groupType })}
          />
          <p className="text-center text-xs text-slate-500">
            This is a {GROUP_TYPE_LABELS[group.groupType]} space. <Link href="/pricing" className="underline">Pick a different role at checkout</Link> to join other audiences (one role per account).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">New post in {group.name}</h1>
        <p className="mt-1 text-xs text-slate-500">
          You'll appear publicly as “Anonymous Verified {session.user.role.replace("VERIFIED_", "").toLowerCase()}”
          — your real identity stays private but is tracked internally to prevent abuse.
        </p>
        <div className="mt-6">
          <CreatePostForm slug={group.slug} />
        </div>
      </div>
    </div>
  );
}
