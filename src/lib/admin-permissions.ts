/**
 * Admin permission system.
 *
 * Two-layer model:
 *   1. Role gate. MASTER_ADMIN gets every permission implicitly. ADMIN
 *      gets the permissions stored on `User.adminPermissions`. Every other
 *      role gets nothing.
 *   2. Per-action helpers. Pages and APIs call `canManageAdmins(session)`
 *      / `canApproveVerifications(session)` / etc. — never read the
 *      permissions JSON directly. Lets us tighten or relax the rules in
 *      one place.
 *
 * `AdminStatus.DISABLED` zeroes everything out so a soft-disabled admin
 * keeps their session token but cannot actually do anything in the portal.
 */
import type { Session } from "next-auth";
import { UserRole, AdminStatus } from "@prisma/client";

/** Canonical set of permission keys. Keep alphabetized + comment any new key. */
export type AdminPermissionKey =
  | "canManageAdmins"
  | "canApproveVerifications"
  | "canApproveConnections"
  | "canModerateReviews"
  | "canManageSchools"
  | "canManageCoaches"
  | "canImportData"
  | "canManageBilling"
  | "canViewAuditLogs";

export interface AdminPermissions {
  canManageAdmins: boolean;
  canApproveVerifications: boolean;
  canApproveConnections: boolean;
  canModerateReviews: boolean;
  canManageSchools: boolean;
  canManageCoaches: boolean;
  canImportData: boolean;
  canManageBilling: boolean;
  canViewAuditLogs: boolean;
}

/** Sensible default for a newly-created staff admin. Master admin can edit. */
export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  canManageAdmins: false,
  canApproveVerifications: true,
  canApproveConnections: true,
  canModerateReviews: true,
  canManageSchools: false,
  canManageCoaches: false,
  canImportData: false,
  canManageBilling: false,
  canViewAuditLogs: false,
};

/** Master-admin shape — all true. Returned by `permissionsFor` for owners. */
export const ALL_PERMISSIONS: AdminPermissions = {
  canManageAdmins: true,
  canApproveVerifications: true,
  canApproveConnections: true,
  canModerateReviews: true,
  canManageSchools: true,
  canManageCoaches: true,
  canImportData: true,
  canManageBilling: true,
  canViewAuditLogs: true,
};

/** Empty shape used for non-admins or DISABLED admins. */
export const NO_PERMISSIONS: AdminPermissions = {
  canManageAdmins: false,
  canApproveVerifications: false,
  canApproveConnections: false,
  canModerateReviews: false,
  canManageSchools: false,
  canManageCoaches: false,
  canImportData: false,
  canManageBilling: false,
  canViewAuditLogs: false,
};

export const PERMISSION_LABELS: Record<AdminPermissionKey, string> = {
  canManageAdmins: "Manage admins (master only)",
  canApproveVerifications: "Approve verification requests",
  canApproveConnections: "Approve athlete/student connections",
  canModerateReviews: "Moderate reviews & reports",
  canManageSchools: "Manage schools / programs",
  canManageCoaches: "Manage coaches",
  canImportData: "Run CSV imports",
  canManageBilling: "Manage billing / subscriptions",
  canViewAuditLogs: "View audit logs",
};

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Coerce whatever shape sits on `User.adminPermissions` (Prisma `Json`) into
 * a clean `AdminPermissions` object. Unknown keys are dropped. Missing keys
 * default to `false` so a freshly-promoted admin with `null` permissions
 * gets nothing rather than silently inheriting old defaults.
 */
export function normalizePermissions(raw: unknown): AdminPermissions {
  const out: AdminPermissions = { ...NO_PERMISSIONS };
  if (!raw || typeof raw !== "object") return out;
  for (const k of Object.keys(out) as AdminPermissionKey[]) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

/**
 * Statuses that block every admin permission. The team UI exposes
 * "disable / suspend / remove" as distinct user-facing actions but they
 * collapse to the same access surface — sign-in blocked, every permission
 * check returns false. INVITED is also non-functional because the user
 * hasn't accepted the rules yet, but they're allowed onto /admin/onboarding.
 */
export const BLOCKING_ADMIN_STATUSES: ReadonlySet<AdminStatus> = new Set([
  AdminStatus.DISABLED,
  AdminStatus.SUSPENDED,
  AdminStatus.REMOVED,
]);

/** Convenience: is this status currently blocking access? */
export function isBlockingAdminStatus(s: AdminStatus | null | undefined): boolean {
  return !!s && BLOCKING_ADMIN_STATUSES.has(s);
}

/**
 * Resolve the effective permission shape for the signed-in user. Any
 * blocking admin status (DISABLED / SUSPENDED / REMOVED) and INVITED both
 * get NO_PERMISSIONS, master admins get ALL_PERMISSIONS, regular ACTIVE
 * admins get whatever is on their `adminPermissions` JSON.
 */
export function permissionsFor(
  user: { role: UserRole; adminStatus?: AdminStatus | null; adminPermissions?: unknown } | null | undefined
): AdminPermissions {
  if (!user) return NO_PERMISSIONS;
  if (user.role === UserRole.MASTER_ADMIN) return ALL_PERMISSIONS;
  if (user.role !== UserRole.ADMIN) return NO_PERMISSIONS;
  if (isBlockingAdminStatus(user.adminStatus)) return NO_PERMISSIONS;
  // INVITED admins haven't accepted the rules yet — they only get past the
  // /admin/onboarding gate. Treat as zero-permission everywhere else.
  if (user.adminStatus === AdminStatus.INVITED) return NO_PERMISSIONS;
  return normalizePermissions(user.adminPermissions);
}

// ---------------------------------------------------------------------------
// Session-level helpers — what every page / API actually calls
// ---------------------------------------------------------------------------

export function isMasterAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === UserRole.MASTER_ADMIN;
}

/** ADMIN or MASTER_ADMIN — the gate for entering /admin at all. */
export function isAnyAdmin(session: Session | null | undefined): boolean {
  const r = session?.user?.role;
  return r === UserRole.ADMIN || r === UserRole.MASTER_ADMIN;
}

function p(session: Session | null | undefined): AdminPermissions {
  return permissionsFor(session?.user as any);
}

export function canManageAdmins(s: Session | null | undefined): boolean {
  // Hard-coded: only master admin can manage other admins, even if a
  // permission flag is somehow flipped on a regular admin row.
  return isMasterAdmin(s);
}

export function canApproveVerifications(s: Session | null | undefined): boolean {
  return p(s).canApproveVerifications;
}
export function canApproveConnections(s: Session | null | undefined): boolean {
  return p(s).canApproveConnections;
}
export function canModerateReviews(s: Session | null | undefined): boolean {
  return p(s).canModerateReviews;
}
export function canManageSchools(s: Session | null | undefined): boolean {
  return p(s).canManageSchools;
}
export function canManageCoaches(s: Session | null | undefined): boolean {
  return p(s).canManageCoaches;
}
export function canImportData(s: Session | null | undefined): boolean {
  return p(s).canImportData;
}
export function canManageBilling(s: Session | null | undefined): boolean {
  return p(s).canManageBilling;
}
export function canViewAuditLogs(s: Session | null | undefined): boolean {
  // Master always; staff admins only if explicitly granted.
  if (isMasterAdmin(s)) return true;
  return p(s).canViewAuditLogs;
}

/**
 * Convenience: returns true if ANY admin permission resolves true.
 * Used to gate access to the `/admin/dashboard` shell — even DISABLED admins
 * fall through to the "your account is disabled" message rather than 404.
 */
export function hasAnyAdminPermission(s: Session | null | undefined): boolean {
  if (isMasterAdmin(s)) return true;
  const perms = p(s);
  return Object.values(perms).some(Boolean);
}
