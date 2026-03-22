import { describe, it, expect, vi } from "vitest";
import {
  getCategoryForType,
  getDefaultChannels,
  resolveChannels,
  isQuietHours,
  buildNotificationTitle,
} from "./notification-service.js";

describe("getCategoryForType", () => {
  it("should return scheduling for job_needs_allocation", () => {
    expect(getCategoryForType("job_needs_allocation")).toBe("scheduling");
  });

  it("should return accounts for invoice_overdue", () => {
    expect(getCategoryForType("invoice_overdue")).toBe("accounts");
  });

  it("should return credit for credit_warning", () => {
    expect(getCategoryForType("credit_warning")).toBe("credit");
  });

  it("should return compliance for entity_noncompliant", () => {
    expect(getCategoryForType("entity_noncompliant")).toBe("compliance");
  });

  it("should return system for system_announcement", () => {
    expect(getCategoryForType("system_announcement")).toBe("system");
  });

  it("should return job_lifecycle for job_status_changed", () => {
    expect(getCategoryForType("job_status_changed")).toBe("job_lifecycle");
  });
});

describe("getDefaultChannels", () => {
  it("should return push and in_app for scheduling types", () => {
    const channels = getDefaultChannels("job_needs_allocation");
    expect(channels).toEqual(["push", "in_app"]);
  });

  it("should return push, in_app, and email for credit types", () => {
    const channels = getDefaultChannels("credit_warning");
    expect(channels).toEqual(["push", "in_app", "email"]);
  });

  it("should return only in_app for system types", () => {
    const channels = getDefaultChannels("system_announcement");
    expect(channels).toEqual(["in_app"]);
  });
});

describe("resolveChannels", () => {
  it("should return defaults when preferences are null", () => {
    const channels = resolveChannels("job_needs_allocation", null);
    expect(channels).toEqual(["push", "in_app"]);
  });

  it("should return empty array when globalEnabled is false", () => {
    const channels = resolveChannels("credit_warning", {
      globalEnabled: false,
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
    });
    expect(channels).toEqual([]);
  });

  it("should filter out disabled channels", () => {
    const channels = resolveChannels("credit_warning", {
      globalEnabled: true,
      pushEnabled: false,
      emailEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
    });
    expect(channels).toEqual(["in_app", "email"]);
  });

  it("should apply per-type overrides", () => {
    const channels = resolveChannels("credit_warning", {
      globalEnabled: true,
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
      channelOverrides: {
        credit_warning: { email: false },
      },
    });
    expect(channels).toEqual(["push", "in_app"]);
  });
});

describe("isQuietHours", () => {
  it("should return false when inputs are null", () => {
    expect(isQuietHours(null, null)).toBe(false);
  });

  it("should return false when inputs are undefined", () => {
    expect(isQuietHours(undefined, undefined)).toBe(false);
  });

  it("should detect quiet hours during a normal range", () => {
    // Mock current time to 23:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 22, 23, 0));
    expect(isQuietHours("22:00", "06:00")).toBe(true);
    vi.useRealTimers();
  });

  it("should detect non-quiet hours outside a normal range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 22, 10, 0));
    expect(isQuietHours("22:00", "06:00")).toBe(false);
    vi.useRealTimers();
  });

  it("should handle same-day range (not wrapping midnight)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 22, 14, 0));
    expect(isQuietHours("12:00", "17:00")).toBe(true);
    vi.useRealTimers();
  });

  it("should handle time just before start as not quiet", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 22, 21, 59));
    expect(isQuietHours("22:00", "06:00")).toBe(false);
    vi.useRealTimers();
  });
});

describe("buildNotificationTitle", () => {
  it("should substitute variables in template", () => {
    const result = buildNotificationTitle("job_needs_allocation", { job_number: "JOB-001" });
    expect(result).toBe("Job JOB-001 needs allocation");
  });

  it("should keep missing variables as-is", () => {
    const result = buildNotificationTitle("job_needs_allocation", {});
    expect(result).toBe("Job {job_number} needs allocation");
  });

  it("should handle multiple variables", () => {
    const result = buildNotificationTitle("credit_warning", {
      customer_name: "Acme Corp",
      utilisation: "85",
    });
    expect(result).toBe("Credit warning: Acme Corp at 85%");
  });

  it("should handle templates with no variables", () => {
    const result = buildNotificationTitle("system_announcement", {});
    expect(result).toBe("System announcement");
  });
});
