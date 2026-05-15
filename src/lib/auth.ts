import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { rateLimitCheck, clientIpFrom } from "@/lib/rate-limit";
import {
  recordFailedAdminLogin,
  resetAdminLoginFailures,
} from "@/lib/login-failure-tracker";
import { sendAdminAlertEmail } from "@/lib/email/notifications";
import { AdminStatus, UserRole } from "@prisma/client";

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

        // Failed-credentials path: we count this as a failure so brute-force
        // attacks against admin accounts trigger a security alert. We only
        // bother tracking when the email actually maps to an admin row —
        // typo'd emails generate noise that's not actionable.
        const trackFailure = (reason: string) => {
          if (
            !user ||
            (user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN)
          ) {
            return;
          }
          const { count, thresholdExceeded } = recordFailedAdminLogin(email);
          if (thresholdExceeded) {
            void sendAdminAlertEmail({
              event: "login_failure_threshold",
              subjectName: user.name,
              subjectEmail: user.email,
              attemptCount: count,
              reason,
            });
          }
        };

        if (!user?.passwordHash) {
          trackFailure("no password set / unknown account");
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          trackFailure("wrong password");
          return null;
        }

        // Block any non-ACTIVE/INVITED admin status at sign-in. Soft-archived
        // accounts (DISABLED / SUSPENDED / REMOVED) preserve history but
        // cannot enter the portal. INVITED is allowed through so the
        // /admin/onboarding gate can complete setup. We DON'T count this as
        // a brute-force failure — the credential was correct.
        if (
          (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) &&
          (user.adminStatus === AdminStatus.DISABLED ||
            user.adminStatus === AdminStatus.SUSPENDED ||
            user.adminStatus === AdminStatus.REMOVED)
        ) {
          return null;
        }

        // Successful credentials sign-in — reset the failure counter so
        // the next attack starts from zero.
        resetAdminLoginFailures(email);

        // Track last login for the admin team table. Non-admin updates are
        // harmless and useful for support if a user disputes a session.
        await prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(() => {
            // never block sign-in on a write failure
          });

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
      // ----- Initial hydration -----
      // On sign-in (`user` is set) or after a forced `update()` from the
      // client, look up the user by email so we have a reliable id to
      // refetch by below.
      if (user || trigger === "update") {
        const email = (user?.email ?? token.email) as string | undefined;
        if (email) {
          const dbUser = await prisma.user.findUnique({ where: { email } });
          if (dbUser) {
            token.id = dbUser.id;
          }
        }
      } else if (!token.id && token.email) {
        // Older tokens (created before we started populating `id`) — recover
        // by looking up via email so the per-request refetch below has a key.
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true },
        });
        if (dbUser) token.id = dbUser.id;
      }

      // ----- Per-request refetch -----
      // Single targeted read per request, for any signed-in user. This is
      // the source of truth for everything the session callback exposes:
      //   - `verificationStatus` so an admin's APPROVE flips the user's
      //     "Verify your role" CTA to "Verified" on the very next request
      //     without needing the user to sign out / sign back in.
      //   - `role` / `paymentVerified` / `subscriptionStatus` for the same
      //     freshness reason.
      //   - `adminStatus` / `adminPermissions` so disable / suspend /
      //     remove / force-logout takes effect immediately.
      //
      // One DB read on every authed request is the price of "no stale
      // state" — the same cost we already paid for admin users.
      if (token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            verificationStatus: true,
            paymentVerified: true,
            subscriptionStatus: true,
            adminStatus: true,
            adminPermissions: true,
            sessionsRevokedAt: true,
          },
        });

        // User row vanished — force sign-out by clearing every signal the
        // session callback reads.
        if (!fresh) {
          delete token.id;
          delete token.role;
          delete token.verificationStatus;
          delete token.paymentVerified;
          delete token.subscriptionStatus;
          delete token.adminStatus;
          delete token.adminPermissions;
          return token;
        }

        // Admin force-logout: tokens issued before the revoke timestamp are
        // treated as signed out. Only meaningful for admin roles — staff
        // who get disabled / suspended / removed expect immediate
        // session invalidation. NextAuth's `iat` is seconds, so compare
        // in seconds. Missing `iat` (older tokens) is safest to treat as
        // revoked.
        if (
          (fresh.role === UserRole.ADMIN || fresh.role === UserRole.MASTER_ADMIN) &&
          fresh.sessionsRevokedAt
        ) {
          const revokedAtSec = Math.floor(fresh.sessionsRevokedAt.getTime() / 1000);
          const iat = typeof token.iat === "number" ? token.iat : 0;
          if (iat <= revokedAtSec) {
            delete token.id;
            delete token.role;
            delete token.verificationStatus;
            delete token.paymentVerified;
            delete token.subscriptionStatus;
            delete token.adminStatus;
            delete token.adminPermissions;
            return token;
          }
        }

        // Sync the live shape into the token. Importantly we never
        // *downgrade* during this sync — every value is read fresh from
        // the DB which is the canonical source of truth, so a sign-in,
        // sign-out, role update, or onboarding flow can only change
        // verification state via an explicit DB write (admin approval
        // endpoint, role-onboarding endpoint, etc.).
        token.role = fresh.role;
        token.verificationStatus = fresh.verificationStatus;
        token.paymentVerified = fresh.paymentVerified;
        token.subscriptionStatus = fresh.subscriptionStatus;
        token.adminStatus = fresh.adminStatus ?? null;
        token.adminPermissions = (fresh.adminPermissions as any) ?? null;
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
        session.user.adminStatus = (token.adminStatus as any) ?? null;
        session.user.adminPermissions = (token.adminPermissions as any) ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export type Roles =
  | "VIEWER"
  | "VERIFIED_ATHLETE"
  | "VERIFIED_RECRUIT"
  | "VERIFIED_STUDENT"
  | "VERIFIED_PARENT"
  | "ADMIN"
  | "MASTER_ADMIN";
