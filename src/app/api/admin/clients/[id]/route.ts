import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, conflict, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { clientUpdateSchema } from "@/lib/validation";
import { mapClient, mapPayment, mapWebsite } from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const client = getSupabase();
  const { data: row, error } = await client.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) return badRequest("Failed to load client");
  if (!row) return notFound("Client not found");

  const [websitesRes, paymentsRes] = await Promise.all([
    client
      .from("websites")
      .select("*, domains:website_domains(*)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("payments")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const payments = (paymentsRes.data ?? []).map(mapPayment);
  const successfulPayments = payments.filter((p) => p.status === "successful");
  const totalDevelopment = successfulPayments
    .filter((p) => p.purpose === "development" || p.purpose === "additional_development")
    .reduce((sum, p) => sum + p.amountPaise, 0);
  const totalAmc = successfulPayments
    .filter((p) => p.purpose === "amc_renewal")
    .reduce((sum, p) => sum + p.amountPaise, 0);
  const totalPaid = successfulPayments.reduce((sum, p) => sum + p.amountPaise, 0);
  const totalCharged = (websitesRes.data ?? []).reduce(
    (sum, w) =>
      sum +
      Number(w.development_cost_paise ?? 0) +
      Number(w.domain_charge_paise ?? 0) +
      Number(w.hosting_charge_paise ?? 0),
    0
  );

  return ok({
    client: mapClient(row),
    websites: (websitesRes.data ?? []).map(mapWebsite),
    payments,
    summary: {
      totalWebsites: websitesRes.data?.length ?? 0,
      totalChargedPaise: totalCharged,
      totalPaidPaise: totalPaid,
      totalDevelopmentPaidPaise: totalDevelopment,
      totalAmcPaidPaise: totalAmc,
      outstandingPaise: Math.max(0, totalCharged - totalPaid),
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, clientUpdateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: previous } = await client.from("clients").select("*").eq("id", id).maybeSingle();
  if (!previous) return notFound("Client not found");

  const patch: Record<string, unknown> = {};
  const fieldMap: Record<string, string> = {
    businessName: "business_name",
    contactPerson: "contact_person",
    whatsappNumber: "whatsapp_number",
    pinCode: "pin_code",
  };
  for (const [key, value] of Object.entries(body.data)) {
    if (value === undefined) continue;
    patch[fieldMap[key] ?? key] = value;
  }

  const { data, error } = await client.from("clients").update(patch).eq("id", id).select("*").single();
  if (error) return badRequest("Failed to update client");

  await logActivity(client, {
    eventType: ActivityEventTypes.ClientUpdated,
    clientId: id,
    actor: session.username,
    description: `Client "${data.name}" updated`,
    previousValue: mapClient(previous),
    newValue: mapClient(data),
  });

  return ok(mapClient(data));
}

export async function DELETE(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;
  const mode = new URL(request.url).searchParams.get("mode"); // "archive" | absent

  const client = getSupabase();
  const { data: previous } = await client.from("clients").select("*").eq("id", id).maybeSingle();
  if (!previous) return notFound("Client not found");

  // Explicit archive mode: always soft-archive, never hard-delete.
  if (mode === "archive") {
    const { data, error } = await client
      .from("clients")
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return badRequest("Failed to archive client");

    const { data: clientWebsites } = await client
      .from("websites")
      .select("id, name, public_id")
      .eq("client_id", id)
      .eq("archived", false);

    const websiteIds = (clientWebsites ?? []).map((w) => w.id);
    if (websiteIds.length > 0) {
      await client
        .from("websites")
        .update({ archived: true, archived_at: new Date().toISOString(), status: "archived" })
        .in("id", websiteIds);

      await client
        .from("amc_contracts")
        .update({ access_status: "archived", suspension_reason: "Client archived" })
        .in("website_id", websiteIds);

      for (const website of clientWebsites ?? []) {
        invalidateLicenseCache(website.public_id);
      }
    }

    await logActivity(client, {
      eventType: ActivityEventTypes.ClientArchived,
      clientId: id,
      actor: session.username,
      description: `Client "${previous.name}" archived (${websiteIds.length} website(s) archived too)`,
      previousValue: mapClient(previous),
      newValue: mapClient(data),
    });

    return ok({
      archived: true,
      client: mapClient(data),
      websitesArchived: websiteIds.length,
      message: `Client "${previous.name}" archived; ${websiteIds.length} website(s) also archived. History preserved.`,
    });
  }

  // Safeguard: clients with any related records are archived, never hard-deleted.
  // Websites, invoices, payments or refunds all block a hard delete — archive instead.
  const [websiteCountRes, invoiceCountRes, paymentCountRes] = await Promise.all([
    client.from("websites").select("id", { count: "exact", head: true }).eq("client_id", id),
    client.from("invoices").select("id", { count: "exact", head: true }).eq("client_id", id),
    client.from("payments").select("id", { count: "exact", head: true }).eq("client_id", id),
  ]);

  const blockers: string[] = [];
  if ((websiteCountRes.count ?? 0) > 0) blockers.push(`${websiteCountRes.count} website(s)`);
  if ((invoiceCountRes.count ?? 0) > 0) blockers.push(`${invoiceCountRes.count} invoice(s)`);
  if ((paymentCountRes.count ?? 0) > 0) blockers.push(`${paymentCountRes.count} payment(s)`);

  if (blockers.length > 0) {
    // Cascade: archive the client AND its websites so nothing keeps showing as active.
    const { data, error } = await client
      .from("clients")
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return badRequest("Failed to archive client");

    const { data: clientWebsites } = await client
      .from("websites")
      .select("id, name, public_id")
      .eq("client_id", id);

    const websiteIds = (clientWebsites ?? []).map((website) => website.id);
    if (websiteIds.length > 0) {
      await client
        .from("websites")
        .update({ archived: true, archived_at: new Date().toISOString(), status: "archived" })
        .in("id", websiteIds);

      await client
        .from("amc_contracts")
        .update({ access_status: "archived", suspension_reason: "Client archived by admin" })
        .in("website_id", websiteIds);

      for (const website of clientWebsites ?? []) {
        invalidateLicenseCache(website.public_id);
      }
    }

    await logActivity(client, {
      eventType: ActivityEventTypes.ClientArchived,
      clientId: id,
      actor: session.username,
      description: `Client "${previous.name}" archived — has ${blockers.join(", ")}; ${websiteIds.length} website(s) archived too`,
      previousValue: mapClient(previous),
      newValue: mapClient(data),
    });
    return ok({ archived: true, client: mapClient(data), websitesArchived: websiteIds.length, message: `Client archived — has ${blockers.join(", ")}; ${websiteIds.length} website(s) also archived. History is preserved.` });
  }

  const { error } = await client.from("clients").delete().eq("id", id);
  if (error) {
    // Any error (e.g. an undetected FK) → archive instead of failing.
    console.error("[clients:delete] hard delete failed, archiving instead", error);
    const { data, error: archiveError } = await client
      .from("clients")
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (archiveError) return conflict("Failed to archive client");
    await logActivity(client, {
      eventType: ActivityEventTypes.ClientArchived,
      clientId: id,
      actor: session.username,
      description: `Client "${previous.name}" archived — hard delete failed`,
      previousValue: mapClient(previous),
      newValue: mapClient(data),
    });
    return ok({ archived: true, client: mapClient(data), message: "Client archived — hard delete was blocked by related records." });
  }

  // Note: after a hard delete, logging with clientId would violate the FK
  // (SET NULL applies to existing rows, not a fresh INSERT), so the client link
  // is omitted — the snapshot in previous_value keeps the ID.
  await logActivity(client, {
    eventType: "client.deleted",
    actor: session.username,
    description: `Client "${previous.name}" deleted`,
    previousValue: mapClient(previous),
  });

  return ok({ deleted: true, message: "Client permanently deleted." });
}
