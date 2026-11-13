import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, conflict, escapeSearch, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { getPagination } from "@/lib/api";
import { websiteCreateSchema } from "@/lib/validation";
import { mapWebsite } from "@/lib/mappers";
import { generatePublicId } from "@/lib/ids";
import { provisionLicenseCredential } from "@/lib/license-provision";
import { createInvoiceWithItems } from "@/lib/invoice-service";
import { ensureAmcContract } from "@/lib/amc-service";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { todayIST } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const searchParams = new URL(request.url).searchParams;
  const pagination = getPagination(searchParams);
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const sort = searchParams.get("sort") || "created_at";
  const order = searchParams.get("order") === "asc";

  let query = getSupabase()
    .from("websites")
    .select("*, client:clients(id, name, client_code), domains:website_domains(*)", { count: "exact" })
    .order(sort, { ascending: order });

  const archived = searchParams.get("archived") === "true";
  if (!archived) query = query.eq("archived", false);
  if (search) {
    const escaped = escapeSearch(search);
    query = query.or(`name.ilike.%${escaped}%,public_id.ilike.%${escaped}%`);
  }
  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[websites:list]", error);
    return badRequest("Failed to load websites");
  }

  return ok({
    items: (data ?? []).map(mapWebsite),
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await parseJsonBody(request, websiteCreateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();

  const { data: clientRow } = await client
    .from("clients")
    .select("id")
    .eq("id", body.data.clientId)
    .maybeSingle();
  if (!clientRow) return badRequest("Client not found");

  // Generate a unique public id.
  let publicId = generatePublicId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await client
      .from("websites")
      .select("id")
      .eq("public_id", publicId)
      .maybeSingle();
    if (!existing) break;
    publicId = generatePublicId();
  }

  const developmentCost = Number(body.data.developmentCost ?? 0);
  const domainCharge = Number(body.data.domainCharge ?? 0);
  const hostingCharge = Number(body.data.hostingCharge ?? 0);

  const { data: website, error } = await client
    .from("websites")
    .insert({
      public_id: publicId,
      client_id: body.data.clientId,
      name: body.data.name,
      description: body.data.description ?? null,
      project_start_date: body.data.projectStartDate ?? null,
      go_live_date: body.data.goLiveDate ?? null,
      development_cost_paise: developmentCost,
      domain_charge_paise: domainCharge,
      hosting_charge_paise: hostingCharge,
      domain_charge_frequency: body.data.domainChargeFrequency ?? "annual",
      hosting_charge_frequency: body.data.hostingChargeFrequency ?? "annual",
      status: body.data.status ?? "development",
      hosting_provider: body.data.hostingProvider ?? null,
      notes: body.data.notes ?? null,
      created_by: session.username,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[websites:create]", error);
    return conflict("Failed to create website");
  }

  if (body.data.domain) {
    await client.from("website_domains").insert({
      website_id: website.id,
      domain: body.data.domain,
      is_primary: true,
      active: true,
    });
  }

  // Always provision a credential so the site can be integrated later.
  let licenseSecret: string | null = null;
  try {
    const provisioned = await provisionLicenseCredential(client, website.id, publicId);
    licenseSecret = provisioned.secret;
  } catch (credentialError) {
    console.error("[websites:create] license provisioning failed", credentialError);
  }

  await client.from("website_settings").insert({ website_id: website.id });

  // Auto-generate the invoice from the entered charges.
  const autoItems: { description: string; quantity: number; unitPricePaise: number }[] = [];
  if (developmentCost > 0) {
    autoItems.push({ description: `Website development — ${website.name}`, quantity: 1, unitPricePaise: developmentCost });
  }
  if (domainCharge > 0) {
    autoItems.push({
      description: `Domain charge${body.data.domainChargeFrequency === "annual" ? " (annual)" : ""} — ${body.data.domain ?? website.name}`,
      quantity: 1,
      unitPricePaise: domainCharge,
    });
  }
  if (hostingCharge > 0) {
    autoItems.push({
      description: `Hosting & AMC (annual) — ${website.name}`,
      quantity: 1,
      unitPricePaise: hostingCharge,
    });
  }
  if (autoItems.length > 0) {
    await createInvoiceWithItems(client, {
      clientId: website.client_id,
      websiteId: website.id,
      invoiceType: "development",
      issueDate: todayIST(),
      dueDate: body.data.goLiveDate ?? null,
      items: autoItems,
      status: "sent",
      createdBy: session.username,
      notes: "Auto-generated from record entry",
    });
  }

  // Create the AMC contract: automatic when the website goes live or an
  // AMC amount was entered on the entry form.
  const amcPrice = body.data.amcAmount ? Number(body.data.amcAmount) : 0;
  if ((body.data.status ?? "development") === "live" || amcPrice > 0) {
    await ensureAmcContract(client, website.id, {
      goLiveDate: body.data.goLiveDate ?? null,
      createdBy: session.username,
      pricePaiseOverride: amcPrice > 0 ? amcPrice : undefined,
    });
  }

  await logActivity(client, {
    eventType: ActivityEventTypes.WebsiteCreated,
    clientId: website.client_id,
    websiteId: website.id,
    actor: session.username,
    description: `Website "${website.name}" created`,
    newValue: mapWebsite(website),
  });

  const result = mapWebsite(website);
  return ok({ website: result, licenseSecret }, { status: 201 });
}
