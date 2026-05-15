import type { AdminStatus, SubscriptionStatus, UserRole, VerificationStatus } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      paymentVerified: boolean;
      subscriptionStatus: SubscriptionStatus;
      verificationStatus: VerificationStatus;
      // Admin lifecycle + per-action grant. `null` for non-admins.
      adminStatus: AdminStatus | null;
      adminPermissions: Record<string, boolean> | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    paymentVerified?: boolean;
    subscriptionStatus?: SubscriptionStatus;
    verificationStatus?: VerificationStatus;
    adminStatus?: AdminStatus | null;
    adminPermissions?: Record<string, boolean> | null;
  }
}
