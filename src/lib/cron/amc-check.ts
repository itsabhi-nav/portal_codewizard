import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAmcStatus } from "@/lib/amc";
import { currentPeriodKey, todayIST } from "@/lib/dates";
import { getAppSettings, type AppSettings } from "@/lib/settings";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { notifyAdmin } from "@/lib/notifications";
import {
  buildWhatsAppLink,
  interpolateTemplate,
  templateVariablesFromContext,
  DEFAULT_WHATSAPP_TEMPLATES,
} from "@/lib/whatsapp";
import { generateRunId } from "@/lib/ids";
import { invalidateLicenseCache } from "@/lib/license";
import { formatINR } from "@/lib/money";

/**
 * Daily AMC check job.
 *
 * Runs independently of client website traffic (scheduled externally).
 * Idempotent: repeated runs do not duplicate activity events or reminders.
 * Processes records in bounded batches to avoid unbounded queries.
 */

export interface CronRunResult {
  runId: string;
  status: "success" | "partial" | "failed";
  trigger: "scheduled" | "manual";
  websitesProcessed: number;
  upcomingCount: number;
  expiredCount: number;
  overdueCount: number;
  newlySuspended: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

const BATCH_SIZE = 200;

interface ProcessResult {
  upcoming: boolean;
  expired: boolean;
  overdue: boolean;
  newlySuspended: boolean;
}

interface ContractRow {
  id: string;
  website_id: string;
  enabled: boolean;
  exempt: boolean;
  renewal_price_paise: number;
  negotiated_price_paise: number | null;
  billing_period_days: number;
  upcoming_threshold_days: number;
  grace_period_days: number;
  validity_start: string | null;
  validity_end: string | null;
  last_renewal_date: string | null;
  next_expiry_date: string | null;
  status: string;
  access_status: string;
  website: {
    id: string;
    public_id: string;
    name: string;
    status: string;
    client_id: string;
    clients: { id: string; name: string; mobile: string | null; whatsapp_number: string | null } | null;
    domains: { domain: string; is_primary: boolean }[];
    settings: {
      reminders_enabled: boolean;
      reminder_intervals: number[] | null;
      whatsapp_number_override: string | null;
    } | null;
  };
}

async function alreadyReminded(
  client: SupabaseClient,
  websiteId: string,
  templateKey: string,
  interval: number | null,
  periodKey: string
): Promise<boolean> {
  const { data } = await client
    .from("notification_logs")
    .select("id")
    .eq("website_id", websiteId)
    .eq("template_key", templateKey)
    .eq("period_key", periodKey)
    .maybeSingle();
  return Boolean(data);
}

async function createReminder(
  client: SupabaseClient,
  contract: ContractRow,
  settings: AppSettings,
  businessDate: string,
  templateKey: string,
  interval: number,
  variables: Record<string, string | number | null | undefined>
): Promise<void> {
  const periodKey = currentPeriodKey();
  if (await alreadyReminded(client, contract.website_id, templateKey, interval, periodKey)) return;

  const { data: template } = await client
    .from("notification_templates")
    .select("body")
    .eq("key", templateKey)
    .maybeSingle();

  const fallback = DEFAULT_WHATSAPP_TEMPLATES.find((item) => item.key === templateKey)?.body ?? "";
  const message = interpolateTemplate(template?.body || fallback, variables);
  const recipient =
    contract.website.settings?.whatsapp_number_override ||
    contract.website.clients?.whatsapp_number ||
    contract.website.clients?.mobile ||
    null;

  await client.from("notification_logs").insert({
    template_key: templateKey,
    website_id: contract.website_id,
    client_id: contract.website.client_id,
    channel: "whatsapp",
    recipient,
    message,
    status: "sent",
    reminder_interval: interval,
    period_key: periodKey,
  });

  const link = buildWhatsAppLink(recipient, message, settings.whatsapp.defaultCountryCode);
  await notifyAdmin(client, {
    type: "reminder_due",
    title: `Renewal reminder due (${interval} days)`,
    message: link
      ? `${contract.website.name}: renewal reminder ready. Open WhatsApp to send.`
      : `${contract.website.name}: renewal reminder ready, but no WhatsApp number is configured.`,
    severity: "info",
    relatedClientId: contract.website.client_id,
    relatedWebsiteId: contract.website_id,
    dedupeKey: `reminder:${contract.website_id}:${templateKey}:${periodKey}`,
  });
}

async function processContract(
  client: SupabaseClient,
  contract: ContractRow,
  settings: AppSettings,
  businessDate: string
): Promise<ProcessResult> {
  const result: ProcessResult = { upcoming: false, expired: false, overdue: false, newlySuspended: false };

  if (!contract.enabled || contract.exempt) {
    return result;
  }
  if (!contract.validity_end) {
    return result;
  }

  const statusResult = computeAmcStatus({
    enabled: true,
    exempt: false,
    validityEnd: contract.validity_end,
    businessDate,
    upcomingThresholdDays: contract.upcoming_threshold_days,
    gracePeriodDays: contract.grace_period_days,
  });

  const previousStatus = contract.status;
  const previousAccess = contract.access_status;
  const wasSuspended = previousAccess === "suspended" || previousAccess === "manual_suspended";
  const isSuspended = statusResult.status === "suspended";
  const website = contract.website;
  const clientName = website.clients?.name ?? "Client";
  const domain = website.domains.find((d) => d.is_primary)?.domain ?? website.domains[0]?.domain ?? null;
  const amountPaise = Number(contract.negotiated_price_paise ?? contract.renewal_price_paise);

  const baseVariables = templateVariablesFromContext({
    clientName,
    websiteName: website.name,
    domain,
    mobile: website.clients?.mobile ?? "",
    renewalAmount: formatINR(amountPaise),
    expiryDate: contract.validity_end,
    daysRemaining: statusResult.daysRemaining,
    daysOverdue: statusResult.daysOverdue,
  });

  // Handle automatic suspension at the end of the grace period.
  if (isSuspended && !wasSuspended) {
    await client
      .from("amc_contracts")
      .update({
        status: "suspended",
        access_status: "suspended",
        suspension_reason: "AMC expired beyond grace period",
        suspended_at: new Date().toISOString(),
        next_expiry_date: contract.validity_end,
      })
      .eq("id", contract.id);

    await client.from("websites").update({ status: "suspended" }).eq("id", website.id);
    invalidateLicenseCache(website.public_id);

    await logActivity(client, {
      eventType: ActivityEventTypes.WebsiteSuspended,
      clientId: website.client_id,
      websiteId: website.id,
      actor: "cron",
      description: `Website "${website.name}" automatically suspended after grace period ended`,
      previousValue: { status: previousStatus, access_status: previousAccess },
      newValue: { status: "suspended", access_status: "suspended" },
    });

    await notifyAdmin(client, {
      type: "website_suspended",
      title: "Website automatically suspended",
      message: `"${website.name}" was suspended because its AMC expired beyond the grace period.`,
      severity: "warning",
      relatedClientId: website.client_id,
      relatedWebsiteId: website.id,
      dedupeKey: `suspended:${website.id}:${contract.validity_end}`,
    });

    result.newlySuspended = true;
  } else if (statusResult.status !== previousStatus) {
    await client
      .from("amc_contracts")
      .update({
        status: statusResult.status,
        next_expiry_date: contract.validity_end,
        access_status: statusResult.status === "overdue" ? "active" : previousAccess,
      })
      .eq("id", contract.id);

    if (statusResult.status === "expired" || statusResult.status === "overdue") {
      await logActivity(client, {
        eventType: ActivityEventTypes.WebsiteExpired,
        clientId: website.client_id,
        websiteId: website.id,
        actor: "cron",
        description: `Website "${website.name}" AMC expired on ${contract.validity_end}`,
        previousValue: { status: previousStatus },
        newValue: { status: statusResult.status },
      });

      await notifyAdmin(client, {
        type: "website_expired",
        title: "Website AMC expired",
        message: `"${website.name}" expired on ${contract.validity_end}. Grace period of ${contract.grace_period_days} days is in effect.`,
        severity: "warning",
        relatedClientId: website.client_id,
        relatedWebsiteId: website.id,
        dedupeKey: `expired:${website.id}:${contract.validity_end}`,
      });
    }
  }

  if (statusResult.status === "upcoming") {
    result.upcoming = true;
    await notifyAdmin(client, {
      type: "renewal_upcoming",
      title: "Renewal upcoming",
      message: `"${website.name}" renews in ${statusResult.daysRemaining} day(s) (${contract.validity_end}).`,
      severity: "info",
      relatedClientId: website.client_id,
      relatedWebsiteId: website.id,
      dedupeKey: `upcoming:${website.id}:${contract.validity_end}`,
    });
  }

  if (statusResult.status === "expired" || statusResult.status === "overdue") {
    result.expired = true;
  }
  if (statusResult.status === "overdue") {
    result.overdue = true;
  }

  // Reminder schedule (only one reminder per interval per renewal period).
  const remindersEnabled = contract.website.settings?.reminders_enabled ?? settings.amc.autoRemind;
  if (remindersEnabled && settings.amc.autoRemind) {
    const intervals = contract.website.settings?.reminder_intervals ?? settings.amc.reminderIntervals;
    const periodKey = currentPeriodKey();

    if (statusResult.daysRemaining !== null && statusResult.daysRemaining >= 0) {
      for (const interval of intervals) {
        if (statusResult.daysRemaining === interval) {
          await createReminder(client, contract, settings, businessDate, `reminder_${interval}`, interval, baseVariables);
        }
      }
    }

    if (statusResult.status === "overdue" && statusResult.daysOverdue <= contract.grace_period_days) {
      if (!(await alreadyReminded(client, contract.website_id, "grace_period", null, periodKey))) {
        await createReminder(client, contract, settings, businessDate, "grace_period", 0, baseVariables);
      }
    }
  }

  return result;
}

export async function runAmcCheck(
  client: SupabaseClient,
  trigger: "scheduled" | "manual" = "scheduled"
): Promise<CronRunResult> {
  const runId = generateRunId();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let websitesProcessed = 0;
  let upcomingCount = 0;
  let expiredCount = 0;
  let overdueCount = 0;
  let newlySuspended = 0;

  await client.from("cron_execution_logs").insert({
    run_id: runId,
    trigger,
    status: "running",
    started_at: startedAt,
    errors: [],
  });

  try {
    const settings = await getAppSettings(client);
    const businessDate = todayIST();

    let offset = 0;
    for (;;) {
      const { data, error } = await client
        .from("amc_contracts")
        .select(
          "*, website:websites(*, clients(*), domains:website_domains(*), settings:website_settings(*))"
        )
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        errors.push(`Failed to load AMC batch: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;

      for (const contract of data as unknown as ContractRow[]) {
        try {
          if (contract.website?.status === "archived") {
            continue;
          }
          const result = await processContract(client, contract, settings, businessDate);
          websitesProcessed += 1;
          if (result.upcoming) upcomingCount += 1;
          if (result.expired) expiredCount += 1;
          if (result.overdue) overdueCount += 1;
          if (result.newlySuspended) newlySuspended += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`website ${contract.website_id ?? "unknown"}: ${message}`);
        }
      }

      offset += BATCH_SIZE;
      if (data.length < BATCH_SIZE) break;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  // Mark overdue invoices (idempotent: only affects matching rows).
  try {
    await client
      .from("invoices")
      .update({ status: "overdue" })
      .in("status", ["sent", "partially_paid"])
      .not("due_date", "is", null)
      .lt("due_date", todayIST());
  } catch (error) {
    errors.push(`Failed to update overdue invoices: ${error instanceof Error ? error.message : String(error)}`);
  }

  const finishedAt = new Date().toISOString();
  const status = errors.length === 0 ? "success" : "partial";

  await client
    .from("cron_execution_logs")
    .update({
      status,
      finished_at: finishedAt,
      websites_processed: websitesProcessed,
      upcoming_count: upcomingCount,
      expired_count: expiredCount,
      overdue_count: overdueCount,
      newly_suspended: newlySuspended,
      errors,
    })
    .eq("run_id", runId);

  await logActivity(client, {
    eventType: status === "success" ? ActivityEventTypes.CronExecuted : ActivityEventTypes.CronFailed,
    actor: trigger === "manual" ? "admin" : "cron",
    description:
      status === "success"
        ? `AMC check completed: ${websitesProcessed} websites processed`
        : `AMC check completed with ${errors.length} error(s)`,
    newValue: {
      runId,
      websitesProcessed,
      upcomingCount,
      expiredCount,
      overdueCount,
      newlySuspended,
      errors,
    },
  });

  if (status !== "success") {
    await notifyAdmin(client, {
      type: "cron_failed",
      title: "AMC check completed with errors",
      message: `${errors.length} error(s) occurred during the AMC check. Review the cron logs.`,
      severity: "error",
      dedupeKey: `cron_failed:${runId}`,
    });
  }

  return {
    runId,
    status,
    trigger,
    websitesProcessed,
    upcomingCount,
    expiredCount,
    overdueCount,
    newlySuspended,
    errors,
    startedAt,
    finishedAt,
  };
}
