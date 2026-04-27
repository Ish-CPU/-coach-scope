import { NextResponse } from "next/server";
import { getSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer on file" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/dashboard`,
  });

  return NextResponse.json({ url: portal.url });
}
