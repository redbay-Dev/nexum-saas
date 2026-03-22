import type { UserRole } from "./constants/index.js";

// ── Permission Keys ──

export const PERMISSIONS = [
  // Organisation
  "manage:organisation",
  "view:organisation",

  // Companies
  "manage:companies",
  "view:companies",

  // Contacts
  "manage:contacts",
  "view:contacts",

  // Addresses
  "manage:addresses",
  "view:addresses",

  // Regions
  "manage:regions",
  "view:regions",

  // Drivers & Employees
  "manage:drivers",
  "view:drivers",

  // Assets & Fleet
  "manage:assets",
  "view:assets",

  // Materials
  "manage:materials",
  "view:materials",

  // Jobs
  "manage:jobs",
  "view:jobs",
  "create:jobs",

  // Scheduling
  "manage:scheduling",
  "view:scheduling",

  // Dockets & Daysheets
  "manage:dockets",
  "view:dockets",
  "approve:dockets",

  // Pricing
  "manage:pricing",
  "view:pricing",

  // Invoicing
  "manage:invoicing",
  "view:invoicing",

  // RCTI
  "manage:rcti",
  "view:rcti",
  "approve:rcti",

  // Invoicing approval & verification
  "approve:invoicing",
  "verify:invoicing",
  "send:invoicing",

  // Credit management
  "manage:credit",
  "view:credit",
  "approve:credit",

  // Xero
  "manage:xero",
  "view:xero",

  // Compliance
  "manage:compliance",
  "view:compliance",

  // Documents
  "manage:documents",
  "view:documents",
  "upload:documents",
  "download:documents",
  "share:documents",
  "admin:documents",

  // Notifications
  "manage:notifications",
  "view:notifications",

  // Reports
  "manage:reports",
  "view:reports",

  // SMS
  "manage:sms",
  "view:sms",

  // AI
  "use:ai",

  // Portal
  "manage:portal",
  "view:portal",

  // Users & Roles
  "manage:users",
  "view:users",

  // Audit Log
  "view:audit_log",

  // Settings
  "manage:settings",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// ── Role → Permission Mapping ──

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  owner: PERMISSIONS, // Owner gets everything

  admin: PERMISSIONS.filter(
    (p) => p !== "manage:organisation", // Admin can't change org identity
  ),

  dispatcher: [
    "view:organisation",
    "view:companies",
    "view:contacts",
    "view:addresses",
    "view:regions",
    "view:drivers",
    "view:assets",
    "view:materials",
    "manage:jobs",
    "view:jobs",
    "create:jobs",
    "manage:scheduling",
    "view:scheduling",
    "view:dockets",
    "view:pricing",
    "view:documents",
    "upload:documents",
    "download:documents",
    "view:notifications",
    "manage:sms",
    "view:sms",
    "use:ai",
  ],

  finance: [
    "view:organisation",
    "view:companies",
    "view:contacts",
    "view:jobs",
    "view:scheduling",
    "manage:dockets",
    "view:dockets",
    "approve:dockets",
    "manage:pricing",
    "view:pricing",
    "manage:invoicing",
    "view:invoicing",
    "manage:rcti",
    "view:rcti",
    "approve:rcti",
    "approve:invoicing",
    "verify:invoicing",
    "send:invoicing",
    "manage:credit",
    "view:credit",
    "approve:credit",
    "manage:xero",
    "view:xero",
    "view:documents",
    "upload:documents",
    "download:documents",
    "share:documents",
    "view:notifications",
    "manage:reports",
    "view:reports",
    "view:audit_log",
  ],

  compliance: [
    "view:organisation",
    "view:companies",
    "view:drivers",
    "view:assets",
    "manage:compliance",
    "view:compliance",
    "manage:documents",
    "view:documents",
    "upload:documents",
    "download:documents",
    "share:documents",
    "view:notifications",
    "manage:reports",
    "view:reports",
  ],

  read_only: PERMISSIONS.filter((p) => p.startsWith("view:")),
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];
  return rolePerms.includes(permission);
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
