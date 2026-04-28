import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { rateLimitCheck, clientIpFrom } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    CredentialsProvider({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, req) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Rate limit: per-IP and per-email-target.
        // - 10 attempts / 5 min per IP defeats lazy password sprays.
        // - 5 attempts / 5 min per email defeats targeted account guessing.
        const headers = new Headers();
        for (const [k, v] of Object.entries(req?.headers ?? {})) {
          if (typeof v === "string") headers.set(k, v);
        }
        const ip = clientIpFrom(headers);
        const ipOk = rateLimitCheck(ip, "auth:signin:ip", { max: 10, windowMs: 5 * 60_000 });
        const emailOk = rateLimitCheck(email.toLowerCase(), "auth:signin:email", {
          max: 5,
          windowMs: 5 * 60_000,
        });
        if (!ipOk.ok || !emailOk.ok) {
          // NextAuth treats null as "invalid credentials" — same response shape
          // as a wrong password, so we don't leak whether the email exists.
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in OR forced refresh, hydrate token from DB
      if (user || trigger === "update") {
        const email = (user?.email ?? token.email) as string | undefined;
        if (email) {
          const dbUser = await prisma.user.findUnique({ where: { email } });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.paymentVerified = dbUser.paymentVerified;
            token.subscriptionStatus = dbUser.subscriptionStatus;
            token.verificationStatus = dbUser.verificationStatus;
          }
        }
      } else if (!token.role && token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email as string } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.paymentVerified = dbUser.paymentVerified;
          token.subscriptionStatus = dbUser.subscriptionStatus;
          token.verificationStatus = dbUser.verificationStatus;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.paymentVerified = Boolean(token.paymentVerified);
        session.user.subscriptionStatus = token.subscriptionStatus as any;
        session.user.verificationStatus = token.verificationStatus as any;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export type Roles = "VIEWER" | "VERIFIED_ATHLETE" | "VERIFIED_STUDENT" | "VERIFIED_PARENT" | "ADMIN";
