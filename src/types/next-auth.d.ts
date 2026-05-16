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
      // Lifecycle fields. `isAlumni` is the canonical signal; `alumniSince`
      // is ISO-string (Dates don't round-trip cleanly through JWT). See
      // src/lib/lifecycle.ts for the helpers that read these.
      isAlumni: boolean;
      alumniSince: string | null;
      graduationYear: number | null;
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
    isAlumni?: boolean;
    alumniSince?: string | null;
    graduationYear?: number | null;
  }
}
