import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, conflict, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { websiteUpdateSchema } from "@/lib/validation";
import {
  mapActivityLog,
  mapAmcContract,
  mapAmcPeriod,
  mapClient,
  mapInvoice,
  mapLicenseCredential,
  mapPayment,
  mapRenewalQuote,
  mapRazorpayOrder,
  mapWebsite,
} from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";
import { ensureAmcContract } from "@/lib/amc-service";
import { computeAmcStatus } from "@/lib/amc";
import { todayIST } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;
  const client = getSupabase();

  const { data: row, error } = await client
    .from("websites")
    .select("*, client:clients(*), domains:website_domains(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) return badRequest("Failed to load website");
  if (!row) return notFound("Website not found");

  const [
    paymentsRes,
    invoicesRes,
    amcRes,
    periodsRes,
    quotesRes,
    ordersRes,
    credentialRes,
    settingsRes,
    activityRes,
  ] = await Promise.all([
    client.from("payments").select("*").eq("website_id", id).order("created_at", { ascending: false }).limit(200),
    client.from("invoices").select("*").eq("website_id", id).order("created_at", { ascending: false }).limit(100),
    client.from("amc_contracts").select("*").eq("website_id", id).maybeSingle(),
    client.from("amc_periods").select("*").eq("website_id", id).order("start_date", { ascending: false }),
    client.from("renewal_quotes").select("*").eq("website_id", id).order("created_at", { ascending: false }),
    client.from("razorpay_orders").select("*").eq("website_id", id).order("created_at", { ascending: false }).limit(100),
    client
      .from("license_credentials")
      .select("id, website_id, public_id, secret_prefix, is_active, last_rotated_at, created_at, updated_at")
      .eq("website_id", id)
      .maybeSingle(),
    client.from("website_settings").select("*").eq("website_id", id).maybeSingle(),
    client
      .from("activity_logs")
      .select("*")
      .eq("website_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const amc = amcRes.data ? mapAmcContract(amcRes.data) : null;
  const businessDate = todayIST();
  const liveStatus = amc
    ? computeAmcStatus({
        enabled: amc.enabled,
        exempt: amc.exempt,
        validityEnd: amc.validityEnd,
        businessDate,
        upcomingThresholdDays: amc.upcomingThresholdDays,
        gracePeriodDays: amc.gracePeriodDays,
      })
    : null;

  const payments = (paymentsRes.data ?? []).map(mapPayment);
  const successful = payments.filter((p) => p.status === "successful");
  const totalPaid = successful.reduce((sum, p) => sum + p.amountPaise, 0);

  return ok({
    website: mapWebsite(row),
    client: row.client ? mapClient(row.client) : null,
    payments,
    invoices: (invoicesRes.data ?? []).map(mapInvoice),
    amc,
    liveStatus,
    periods: (periodsRes.data ?? []).map(mapAmcPeriod),
    quotes: (quotesRes.data ?? []).map(mapRenewalQuote),
    orders: (ordersRes.data ?? []).map(mapRazorpayOrder),
    credential: credentialRes.data ? mapLicenseCredential(credentialRes.data) : null,
    settings: settingsRes.data ?? null,
    activity: (activityRes.data ?? []).map(mapActivityLog),
    summary: {
      totalPaidPaise: totalPaid,
      developmentPaidPaise: successful
        .filter((p) => p.purpose === "development" || p.purpose === "additional_development")
        .reduce((sum, p) => sum + p.amountPaise, 0),
      amcPaidPaise: successful
        .filter((p) => p.purpose === "amc_renewal")
        .reduce((sum, p) => sum + p.amountPaise, 0),
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, websiteUpdateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: previous } = await client.from("websites").select("*").eq("id", id).maybeSingle();
  if (!previous) return notFound("Website not found");

  const fieldMap: Record<string, string> = {
    projectStartDate: "project_start_date",
    goLiveDate: "go_live_date",
    developmentCost: "development_cost_paise",
    domainCharge: "domain_charge_paise",
    hostingCharge: "hosting_charge_paise",
    domainChargeFrequency: "domain_charge_frequency",
    hostingChargeFrequency: "hosting_charge_frequency",
    hostingProvider: "hosting_provider",
  };
  const { amcAmount, ...restData } = body.data;
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(restData)) {
    if (value === undefined) continue;
    patch[fieldMap[key] ?? key] = value;
  }

  const { data, error } = await client.from("websites").update(patch).eq("id", id).select("*").single();
  if (error) return badRequest("Failed to update website");

  // Live-sync the auto-generated development invoice when the price of the
  // website changes — so balances everywhere reflect reality automatically.
  const chargesChanged = ["development_cost_paise", "domain_charge_paise", "hosting_charge_paise"].some(
    (key) => key in patch
  );
  if (chargesChanged) {
    const dev = Number(data.development_cost_paise ?? 0);
    const dom = Number(data.domain_charge_paise ?? 0);
    const host = Number(data.hosting_charge_paise ?? 0);
    const { data: inv } = await client
      .from("invoices")
      .select("id, total_paise, amount_paid_paise, status, tax_rate_percent")
      .eq("website_id", id)
      .eq("invoice_type", "development")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (inv) {
      const items: Array<Record<string, unknown>> = [];
      if (dev > 0) {
        items.push({
          invoice_id: inv.id,
          description: `Website development — ${data.name}`,
          quantity: 1,
          unit_price_paise: dev,
          amount_paise: dev,
          tax_rate_percent: 0,
          sort_order: 1,
        });
      }
      if (dom > 0) {
        items.push({
          invoice_id: inv.id,
          description: `Domain charge (annual) — ${data.domain ?? data.name}`,
          quantity: 1,
          unit_price_paise: dom,
          amount_paise: dom,
          tax_rate_percent: 0,
          sort_order: 2,
        });
      }
      if (host > 0) {
        items.push({
          invoice_id: inv.id,
          description: `Hosting & AMC (annual) — ${data.name}`,
          quantity: 1,
          unit_price_paise: host,
          amount_paise: host,
          tax_rate_percent: 0,
          sort_order: 3,
        });
      }
      const total = dev + dom + host;
      const paid = Number(inv.amount_paid_paise ?? 0);
      let status = inv.status as string;
      if (paid >= total && total > 0) {
        status = "paid";
      } else if (paid > 0) {
        status = "partially_paid";
      } else if (status === "paid" || status === "partially_paid") {
        status = "sent";
      }
      await client.from("invoice_items").delete().eq("invoice_id", inv.id);
      if (items.length > 0) await client.from("invoice_items").insert(items);
      await client
        .from("invoices")
        .update({ subtotal_paise: total, total_paise: total, tax_paise: 0, status })
        .eq("id", inv.id);
      await logActivity(client, {
        eventType: "invoice.updated",
        clientId: data.client_id,
        websiteId: id,
        actor: session.username,
        description: `Development invoice adjusted after charge change — new total ₹${(total / 100).toLocaleString("en-IN")}`,
        previousValue: { totalPaise: Number(inv.total_paise ?? 0), status: inv.status },
        newValue: { totalPaise: total, status },
      });
    }
  }

  await logActivity(client, {
    eventType: ActivityEventTypes.WebsiteUpdated,
    clientId: data.client_id,
    websiteId: id,
    actor: session.username,
    description: `Website "${data.name}" updated`,
    previousValue: mapWebsite(previous),
    newValue: mapWebsite(data),
  });

  invalidateLicenseCache(previous.public_id);

  // If the website has just gone live, provision the default AMC (365 days)
  if (patch.status === "live") {
    await ensureAmcContract(client, id, {
      goLiveDate: data.go_live_date ?? null,
      createdBy: session.username,
    });
  }

  // If an AMC amount is provided, update the existing contract's renewal price
  // (or create a default 365-day contract if none exists yet).
  const amcAmountPaise = amcAmount == null ? null : Number(amcAmount);
  if (amcAmountPaise && Number.isFinite(amcAmountPaise) && amcAmountPaise > 0) {
    const { data: existingAmc } = await client
      .from("amc_contracts")
      .select("id")
      .eq("website_id", id)
      .maybeSingle();
    if (existingAmc) {
      await client
        .from("amc_contracts")
        .update({ renewal_price_paise: amcAmountPaise, updated_by: session.username })
        .eq("website_id", id);
    } else {
      await ensureAmcContract(client, id, {
        goLiveDate: data.go_live_date ?? null,
        pricePaiseOverride: amcAmountPaise,
        createdBy: session.username,
      });
    }
  }

  return ok(mapWebsite(data));
}

export async function DELETE(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;
  const mode = new URL(request.url).searchParams.get("mode"); // "archive" | absent

  const client = getSupabase();
  const { data: previous } = await client.from("websites").select("*").eq("id", id).maybeSingle();
  if (!previous) return notFound("Website not found");

  // Explicit archive mode: always soft-archive, never hard-delete.
  if (mode === "archive") {
    const { data, error } = await client
      .from("websites")
      .update({ archived: true, archived_at: new Date().toISOString(), status: "archived" })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return badRequest("Failed to archive website");

    await client
      .from("amc_contracts")
      .update({ access_status: "archived", suspension_reason: "Website archived" })
      .eq("website_id", id);

    await logActivity(client, {
      eventType: "website.archived",
      clientId: data.client_id,
      websiteId: id,
      actor: session.username,
      description: `Website "${data.name}" archived by admin`,
      previousValue: mapWebsite(previous),
      newValue: mapWebsite(data),
    });

    invalidateLicenseCache(previous.public_id);
    return ok({
      archived: true,
      website: mapWebsite(data),
      message: `Website "${data.name}" archived. History preserved.`,
    });
  }

  // Safeguard: websites with FINANCIAL history are never hard-deleted.
  // License credentials alone don't count as history — removal is just integrity.
  const [paymentCountRes, invoiceCountRes, amcPeriodRes] = await Promise.all([
    client.from("payments").select("id", { count: "exact", head: true }).eq("website_id", id),
    client.from("invoices").select("id", { count: "exact", head: true }).eq("website_id", id),
    client.from("amc_periods").select("id", { count: "exact", head: true }).eq("website_id", id),
  ]);

  const blockers: string[] = [];
  if ((paymentCountRes.count ?? 0) > 0) blockers.push(`${paymentCountRes.count} payment(s)`);
  if ((invoiceCountRes.count ?? 0) > 0) blockers.push(`${invoiceCountRes.count} invoice(s)`);
  if ((amcPeriodRes.count ?? 0) > 0) blockers.push(`${amcPeriodRes.count} AMC period(s)`);

  if (blockers.length > 0) {
    const { data, error } = await client
      .from("websites")
      .update({ archived: true, archived_at: new Date().toISOString(), status: "archived" })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return badRequest("Failed to archive website");

    // Reflect the archived state in AMC access control too.
    await client
      .from("amc_contracts")
      .update({ access_status: "archived", suspension_reason: "Website archived by admin" })
      .eq("website_id", id);

    await logActivity(client, {
      eventType: "website.archived",
      clientId: data.client_id,
      websiteId: id,
      actor: session.username,
      description: `Website "${data.name}" archived — has ${blockers.join(", ")}`,
      previousValue: mapWebsite(previous),
      newValue: mapWebsite(data),
    });

    invalidateLicenseCache(previous.public_id);
    return ok({ archived: true, website: mapWebsite(data), message: `Website archived — has ${blockers.join(", ")}. Sites with records are never hard-deleted — only archived.` });
  }

  // Truly empty — permanent delete is allowed.
  const { error } = await client.from("websites").delete().eq("id", id);
  if (error) {
    console.error("[websites:delete] hard delete failed, archiving instead", error);
    const { data, error: archiveError } = await client
      .from("websites")
      .update({ archived: true, archived_at: new Date().toISOString(), status: "archived" })
      .eq("id", id)
      .select("*")
      .single();
    if (archiveError) return conflict("Failed to archive website");

    await client
      .from("amc_contracts")
      .update({ access_status: "archived", suspension_reason: "Website archived by admin" })
      .eq("website_id", id);

    await logActivity(client, {
      eventType: "website.archived",
      clientId: data.client_id,
      websiteId: id,
      actor: session.username,
      description: `Website "${data.name}" archived — hard delete blocked by related records`,
      previousValue: mapWebsite(previous),
      newValue: mapWebsite(data),
    });

    invalidateLicenseCache(previous.public_id);
    return ok({ archived: true, website: mapWebsite(data), message: "Website archived — hard delete was blocked by related records." });
  }

  // Note: after a hard delete, logging with websiteId would violate the FK
  // (activity_logs.website_id → SET NULL does not apply to a fresh INSERT),
  // so the website link is omitted — the snapshot in previous_value keeps the ID.
  await logActivity(client, {
    eventType: "website.deleted",
    clientId: previous.client_id,
    actor: session.username,
    description: `Website "${previous.name}" permanently deleted`,
    previousValue: mapWebsite(previous),
  });

  invalidateLicenseCache(previous.public_id);
  return ok({ deleted: true, message: "Website permanently deleted." });
}
