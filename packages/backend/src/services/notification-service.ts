/**
 * Notification service — creates in-app notifications and routes to channels.
 * Pure functions for notification creation and routing logic.
 */

import type {
  CommunicationType,
  NotificationCategory,
  NotificationChannel,
} from "@nexum/shared";

interface NotificationRouting {
  push: boolean;
  inApp: boolean;
  sms: boolean;
  email: boolean;
}

/**
 * Default channel routing per notification category (doc 13).
 */
const DEFAULT_ROUTING: Record<NotificationCategory, NotificationRouting> = {
  scheduling: { push: true, inApp: true, sms: false, email: false },
  job_lifecycle: { push: true, inApp: true, sms: false, email: false },
  accounts: { push: true, inApp: true, sms: false, email: false },
  credit: { push: true, inApp: true, sms: false, email: true },
  compliance: { push: true, inApp: true, sms: false, email: false },
  system: { push: false, inApp: true, sms: false, email: false },
};

/**
 * Map communication type to category.
 */
const TYPE_TO_CATEGORY: Record<CommunicationType, NotificationCategory> = {
  job_needs_allocation: "scheduling",
  job_requires_attention: "scheduling",
  duplicate_booking: "scheduling",
  contractor_unconfirmed: "scheduling",
  asset_maintenance_due: "scheduling",
  job_status_changed: "job_lifecycle",
  job_issue_reported: "job_lifecycle",
  job_variation: "job_lifecycle",
  job_ready_for_invoicing: "accounts",
  docket_pending_verification: "accounts",
  invoice_overdue: "accounts",
  rcti_pending_approval: "accounts",
  payment_received: "accounts",
  supplier_invoice_received: "accounts",
  credit_warning: "credit",
  credit_limit_exceeded: "credit",
  credit_stop_applied: "credit",
  credit_stop_removed: "credit",
  over_limit_approval_requested: "credit",
  entity_approaching_noncompliance: "compliance",
  entity_noncompliant: "compliance",
  system_announcement: "system",
  integration_error: "system",
};

/**
 * Get the category for a communication type.
 */
export function getCategoryForType(type: CommunicationType): NotificationCategory {
  return TYPE_TO_CATEGORY[type];
}

/**
 * Get the default channels for a communication type.
 */
export function getDefaultChannels(type: CommunicationType): NotificationChannel[] {
  const category = getCategoryForType(type);
  const routing = DEFAULT_ROUTING[category];
  const channels: NotificationChannel[] = [];
  if (routing.push) channels.push("push");
  if (routing.inApp) channels.push("in_app");
  if (routing.sms) channels.push("sms");
  if (routing.email) channels.push("email");
  return channels;
}

/**
 * Resolve effective channels considering user preferences.
 */
export function resolveChannels(
  type: CommunicationType,
  preferences: {
    globalEnabled: boolean;
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    channelOverrides?: Record<string, { push?: boolean; email?: boolean; sms?: boolean; inApp?: boolean }> | null;
  } | null,
): NotificationChannel[] {
  const defaultChannels = getDefaultChannels(type);

  // No preferences → use defaults
  if (!preferences) return defaultChannels;

  // Global disabled → no notifications
  if (!preferences.globalEnabled) return [];

  // Check per-type overrides
  const overrides = preferences.channelOverrides?.[type];

  const channels: NotificationChannel[] = [];

  for (const channel of defaultChannels) {
    // Check global channel toggle
    let enabled = true;
    switch (channel) {
      case "push":
        enabled = preferences.pushEnabled;
        break;
      case "email":
        enabled = preferences.emailEnabled;
        break;
      case "sms":
        enabled = preferences.smsEnabled;
        break;
      case "in_app":
        enabled = preferences.inAppEnabled;
        break;
    }

    // Check per-type override
    if (overrides) {
      const override = overrides[channel === "in_app" ? "inApp" : channel];
      if (override !== undefined) {
        enabled = override;
      }
    }

    if (enabled) channels.push(channel);
  }

  return channels;
}

/**
 * Check if current time falls within quiet hours.
 */
export function isQuietHours(
  quietStart: string | undefined | null,
  quietEnd: string | undefined | null,
): boolean {
  if (!quietStart || !quietEnd) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = quietStart.split(":").map(Number);
  const [endH, endM] = quietEnd.split(":").map(Number);

  if (startH === undefined || startM === undefined || endH === undefined || endM === undefined) {
    return false;
  }

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Wraps midnight
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * Build notification title from type and variables.
 */
export function buildNotificationTitle(
  type: CommunicationType,
  variables: Record<string, string>,
): string {
  const templates: Record<CommunicationType, string> = {
    job_needs_allocation: "Job {job_number} needs allocation",
    job_requires_attention: "Job {job_number} requires attention",
    duplicate_booking: "Duplicate booking detected for {asset_name}",
    contractor_unconfirmed: "{contractor_name} has not confirmed allocation",
    asset_maintenance_due: "{asset_name} maintenance due",
    job_status_changed: "Job {job_number} status: {new_status}",
    job_issue_reported: "Issue reported on job {job_number}",
    job_variation: "Job {job_number} variation",
    job_ready_for_invoicing: "Job {job_number} ready for invoicing",
    docket_pending_verification: "Docket pending verification",
    invoice_overdue: "Invoice {invoice_number} overdue",
    rcti_pending_approval: "RCTI {rcti_number} pending approval",
    payment_received: "Payment received: {amount}",
    supplier_invoice_received: "Supplier invoice received from {supplier_name}",
    credit_warning: "Credit warning: {customer_name} at {utilisation}%",
    credit_limit_exceeded: "Credit limit exceeded: {customer_name}",
    credit_stop_applied: "Credit stop applied: {customer_name}",
    credit_stop_removed: "Credit stop removed: {customer_name}",
    over_limit_approval_requested: "Over-limit approval requested: {customer_name}",
    entity_approaching_noncompliance: "{entity_name} approaching non-compliance",
    entity_noncompliant: "{entity_name} non-compliant",
    system_announcement: "System announcement",
    integration_error: "Integration error: {service_name}",
  };

  const template = templates[type];
  return template.replace(
    /\{(\w+)\}/g,
    (match, key: string) => variables[key] ?? match,
  );
}
