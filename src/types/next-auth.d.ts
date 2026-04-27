import type { SubscriptionStatus, UserRole, VerificationStatus } from "@prisma/client";
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
  }
}
