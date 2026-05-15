import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-inapp";

/**
 * GET  /api/notifications        — list signed-in user's notifications
 * POST /api/notifications        — { id?, all? } mark one or all read
 *
 * Both actions are user-scoped — there's no "view someone else's
 * notifications" path. The list returns the most recent 50 by default.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      subjectType: true,
      subjectId: true,
      data: true,
      read: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ notifications });
}

const postSchema = z.object({
  id: z.string().cuid().optional(),
  all: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.all) {
    const count = await markAllNotificationsRead(session.user.id);
    return NextResponse.json({ ok: true, marked: count });
  }
  if (parsed.data.id) {
    const ok = await markNotificationRead(session.user.id, parsed.data.id);
    return NextResponse.json({ ok });
  }
  return NextResponse.json(
    { error: "Provide either `id` or `all: true`." },
    { status: 400 }
  );
}
