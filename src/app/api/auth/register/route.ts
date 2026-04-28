import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { PASSWORD_BCRYPT_ROUNDS } from "@/lib/security";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

/**
 * Sign up creates a free VIEWER account. The user picks their participation
 * role (Athlete / Student / Parent) on /pricing, which is then stamped onto
 * the account by the Stripe webhook on successful payment.
 */
export async function POST(req: Request) {
  // 5 sign-ups per 5 minutes per IP — slows enumeration + bot floods.
  const limited = rateLimit(req, "auth:register", { max: 5, windowMs: 5 * 60_000 });
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
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      // Defaults: VIEWER, paymentVerified=false, subscriptionStatus=FREE,
      // verificationStatus=NONE.
    },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
