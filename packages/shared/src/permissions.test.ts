import { describe, it, expect } from "vitest";
import { hasPermission, getPermissions, PERMISSIONS } from "./permissions.js";
import { USER_ROLES } from "./constants/index.js";

describe("hasPermission", () => {
  // ── Owner ──

  it("owner should have every permission", () => {
    for (const perm of PERMISSIONS) {
      expect(hasPermission("owner", perm)).toBe(true);
    }
  });

  // ── Admin ──

  it("admin should have all permissions except manage:organisation", () => {
    expect(hasPermission("admin", "manage:organisation")).toBe(false);
    expect(hasPermission("admin", "view:organisation")).toBe(true);
    expect(hasPermission("admin", "manage:jobs")).toBe(true);
    expect(hasPermission("admin", "manage:users")).toBe(true);
    expect(hasPermission("admin", "manage:settings")).toBe(true);
  });

  // ── Dispatcher ──

  it("dispatcher should manage jobs and scheduling", () => {
    expect(hasPermission("dispatcher", "manage:jobs")).toBe(true);
    expect(hasPermission("dispatcher", "create:jobs")).toBe(true);
    expect(hasPermission("dispatcher", "manage:scheduling")).toBe(true);
    expect(hasPermission("dispatcher", "manage:sms")).toBe(true);
    expect(hasPermission("dispatcher", "use:ai")).toBe(true);
  });

  it("dispatcher should NOT manage finance-related features", () => {
    expect(hasPermission("dispatcher", "manage:invoicing")).toBe(false);
    expect(hasPermission("dispatcher", "manage:rcti")).toBe(false);
    expect(hasPermission("dispatcher", "manage:pricing")).toBe(false);
    expect(hasPermission("dispatcher", "manage:xero")).toBe(false);
    expect(hasPermission("dispatcher", "approve:rcti")).toBe(false);
  });

  it("dispatcher should NOT manage companies, drivers, assets, or org", () => {
    expect(hasPermission("dispatcher", "manage:companies")).toBe(false);
    expect(hasPermission("dispatcher", "manage:drivers")).toBe(false);
    expect(hasPermission("dispatcher", "manage:assets")).toBe(false);
    expect(hasPermission("dispatcher", "manage:organisation")).toBe(false);
  });

  // ── Finance ──

  it("finance should manage dockets, pricing, invoicing, RCTI, Xero", () => {
    expect(hasPermission("finance", "manage:dockets")).toBe(true);
    expect(hasPermission("finance", "approve:dockets")).toBe(true);
    expect(hasPermission("finance", "manage:pricing")).toBe(true);
    expect(hasPermission("finance", "manage:invoicing")).toBe(true);
    expect(hasPermission("finance", "manage:rcti")).toBe(true);
    expect(hasPermission("finance", "approve:rcti")).toBe(true);
    expect(hasPermission("finance", "manage:xero")).toBe(true);
    expect(hasPermission("finance", "manage:reports")).toBe(true);
    expect(hasPermission("finance", "view:audit_log")).toBe(true);
  });

  it("finance should NOT manage jobs, scheduling, or compliance", () => {
    expect(hasPermission("finance", "manage:jobs")).toBe(false);
    expect(hasPermission("finance", "manage:scheduling")).toBe(false);
    expect(hasPermission("finance", "manage:compliance")).toBe(false);
    expect(hasPermission("finance", "manage:users")).toBe(false);
  });

  // ── Compliance ──

  it("compliance should manage compliance, documents, and reports", () => {
    expect(hasPermission("compliance", "manage:compliance")).toBe(true);
    expect(hasPermission("compliance", "manage:documents")).toBe(true);
    expect(hasPermission("compliance", "manage:reports")).toBe(true);
  });

  it("compliance should only view org, companies, drivers, and assets", () => {
    expect(hasPermission("compliance", "view:organisation")).toBe(true);
    expect(hasPermission("compliance", "view:companies")).toBe(true);
    expect(hasPermission("compliance", "view:drivers")).toBe(true);
    expect(hasPermission("compliance", "view:assets")).toBe(true);

    expect(hasPermission("compliance", "manage:companies")).toBe(false);
    expect(hasPermission("compliance", "manage:drivers")).toBe(false);
    expect(hasPermission("compliance", "manage:assets")).toBe(false);
  });

  it("compliance should NOT have job, scheduling, or finance permissions", () => {
    expect(hasPermission("compliance", "manage:jobs")).toBe(false);
    expect(hasPermission("compliance", "manage:invoicing")).toBe(false);
    expect(hasPermission("compliance", "manage:scheduling")).toBe(false);
  });

  // ── Read-Only ──

  it("read_only should have all view permissions", () => {
    const viewPerms = PERMISSIONS.filter((p) => p.startsWith("view:"));
    for (const perm of viewPerms) {
      expect(hasPermission("read_only", perm)).toBe(true);
    }
  });

  it("read_only should NOT have any manage, create, approve, or use permissions", () => {
    const writePerms = PERMISSIONS.filter(
      (p) =>
        p.startsWith("manage:") ||
        p.startsWith("create:") ||
        p.startsWith("approve:") ||
        p.startsWith("use:"),
    );
    for (const perm of writePerms) {
      expect(hasPermission("read_only", perm)).toBe(false);
    }
  });
});

describe("getPermissions", () => {
  it("should return an array of permissions for each role", () => {
    for (const role of USER_ROLES) {
      const perms = getPermissions(role);
      expect(Array.isArray(perms)).toBe(true);
      expect(perms.length).toBeGreaterThan(0);
    }
  });

  it("owner should have all permissions", () => {
    const perms = getPermissions("owner");
    expect(perms.length).toBe(PERMISSIONS.length);
  });

  it("admin should have one fewer permission than owner", () => {
    const ownerPerms = getPermissions("owner");
    const adminPerms = getPermissions("admin");
    expect(adminPerms.length).toBe(ownerPerms.length - 1);
  });

  it("read_only should only contain view: permissions", () => {
    const perms = getPermissions("read_only");
    for (const perm of perms) {
      expect(perm).toMatch(/^view:/);
    }
  });

  it("every returned permission should be a valid permission", () => {
    const permSet = new Set<string>(PERMISSIONS);
    for (const role of USER_ROLES) {
      const perms = getPermissions(role);
      for (const perm of perms) {
        expect(permSet.has(perm)).toBe(true);
      }
    }
  });
});

describe("permission matrix completeness", () => {
  it("every role should have view:organisation", () => {
    for (const role of USER_ROLES) {
      expect(
        hasPermission(role, "view:organisation"),
      ).toBe(true);
    }
  });

  it("only owner should have manage:organisation", () => {
    const rolesWithManageOrg = USER_ROLES.filter((role) =>
      hasPermission(role, "manage:organisation"),
    );
    expect(rolesWithManageOrg).toEqual(["owner"]);
  });

  it("dispatcher and finance permissions should not overlap on write operations", () => {
    const dispatcherManage = getPermissions("dispatcher").filter((p) =>
      p.startsWith("manage:"),
    );
    const financeManage = getPermissions("finance").filter((p) =>
      p.startsWith("manage:"),
    );

    // Dispatcher manages jobs/scheduling/sms; Finance manages dockets/pricing/invoicing/rcti/xero/reports
    // They should not share any manage: permissions
    const overlap = dispatcherManage.filter((p) =>
      (financeManage as readonly string[]).includes(p),
    );
    expect(overlap).toEqual([]);
  });
});
