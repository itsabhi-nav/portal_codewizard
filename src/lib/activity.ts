import type { SupabaseClient } from "@supabase/supabase-js";

export interface ActivityEntry {
  eventType: string;
  clientId?: string | null;
  websiteId?: string | null;
  actor?: string;
  description: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}

/** Append an immutable activity log entry. Never throws into the caller path. */
export async function logActivity(client: SupabaseClient, entry: ActivityEntry): Promise<void> {
  try {
    await client.from("activity_logs").insert({
      event_type: entry.eventType,
      client_id: entry.clientId ?? null,
      website_id: entry.websiteId ?? null,
      actor: entry.actor ?? "system",
      description: entry.description,
      previous_value: entry.previousValue ?? null,
      new_value: entry.newValue ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    // Activity logging must never break the primary operation.
    console.error("[activity] failed to log event", entry.eventType, error);
  }
}

export const ActivityEventTypes = {
  ClientCreated: "client.created",
  ClientUpdated: "client.updated",
  ClientArchived: "client.archived",
  WebsiteCreated: "website.created",
  WebsiteUpdated: "website.updated",
  DomainChanged: "domain.changed",
  InvoiceCreated: "invoice.created",
  PaymentReceived: "payment.received",
  PaymentFailed: "payment.failed",
  RefundProcessed: "refund.processed",
  AmcConfigured: "amc.configured",
  AmcPriceChanged: "amc.price_changed",
  NegotiatedPriceApplied: "amc.negotiated_price_applied",
  AmcRenewed: "amc.renewed",
  WebsiteExpired: "website.expired",
  WebsiteSuspended: "website.suspended",
  WebsiteReactivated: "website.reactivated",
  LicenseExemptionApplied: "license.exemption_applied",
  LicenseCredentialCreated: "license.credential_created",
  LicenseCredentialRotated: "license.credential_rotated",
  CronExecuted: "cron.executed",
  CronFailed: "cron.failed",
  WebhookReceived: "webhook.received",
  WebhookFailed: "webhook.failed",
  SettingsUpdated: "settings.updated",
  AdminLogin: "admin.login",
  AdminLoginFailed: "admin.login_failed",
  AdminLogout: "admin.logout",
} as const;
