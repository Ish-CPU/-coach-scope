import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { UserRole, VerificationStatus } from "@prisma/client";
import { weightForRole } from "@/lib/review-weighting";

const schema = z.object({ action: z.enum(["approve", "reject"]) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const request = await prisma.verificationRequest.findUnique({
    where: { id: params.id },
    include: { user: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const approving = parsed.data.action === "approve";
  const status = approving ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;

  // Approving stamps the user with the role they originally selected at checkout.
  // We don't override the user's role unless they're still a free VIEWER.
  let newRole = request.user.role;
  if (
    approving &&
    request.user.role === UserRole.VIEWER &&
    request.targetRole !== UserRole.VIEWER &&
    request.targetRole !== UserRole.ADMIN
  ) {
    newRole = request.targetRole;
  }

  await prisma.$transaction(async (tx) => {
    await tx.verificationRequest.update({
      where: { id: request.id },
      data: { status, reviewedAt: new Date(), reviewedBy: session!.user.id },
    });
    await tx.user.update({
      where: { id: request.userId },
      data: { verificationStatus: status, role: newRole },
    });

    if (approving && newRole !== request.user.role) {
      await tx.review.updateMany({
        where: { authorId: request.userId },
        data: { weight: weightForRole(newRole) },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
