import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { quoteCreateSchema } from "@/lib/validation";
import { mapRenewalQuote } from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";
import { todayIST } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ websiteId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { websiteId } = await params;
  const client = getSupabase();

  const { data, error } = await client
    .from("renewal_quotes")
    .select("*")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false });
  if (error) return badRequest("Failed to load quotes");
  return ok((data ?? []).map(mapRenewalQuote));
}

export async function POST(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { websiteId } = await params;

  const body = await parseJsonBody(request, quoteCreateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: website } = await client
    .from("websites")
    .select("id, public_id, name, client_id")
    .eq("id", websiteId)
    .maybeSingle();
  if (!website) return notFound("Website not found");

  const { data: contract } = await client
    .from("amc_contracts")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();
  if (!contract) return notFound("AMC contract not found");

  const businessDate = todayIST();
  const renewalPrice = Number(contract.renewal_price_paise);
  const amount = Number(body.data.amount ?? 0);
  const quoteType = body.data.quoteType ?? "one_time_discount";

  // Supersede all existing active quotes for this website.
  await client
    .from("renewal_quotes")
    .update({ status: "superseded" })
    .eq("website_id", websiteId)
    .eq("status", "active");

  // Apply the price change to the contract.
  const permanentPrice = body.data.permanentNewAnnualPrice ?? null;
  let negotiatedPrice: number | null = null;

  if (quoteType === "permanent_price_change") {
    const newAnnual = permanentPrice ?? amount;
    await client
      .from("amc_contracts")
      .update({
        renewal_price_paise: newAnnual,
        negotiated_price_paise: null,
        updated_by: session.username,
      })
      .eq("id", contract.id);
  } else {
    negotiatedPrice = amount > 0 && amount < renewalPrice ? amount : null;
    await client
      .from("amc_contracts")
      .update({
        negotiated_price_paise: negotiatedPrice,
        updated_by: session.username,
      })
      .eq("id", contract.id);
  }

  const discount = Math.max(0, renewalPrice - amount);
  const { data: quote, error } = await client
    .from("renewal_quotes")
    .insert({
      website_id: websiteId,
      amc_contract_id: contract.id,
      amount_paise: amount,
      original_amount_paise: renewalPrice,
      discount_paise: discount,
      discount_percent: renewalPrice > 0 ? Math.round((discount / renewalPrice) * 10000) / 100 : null,
      quote_type: quoteType,
      reason: body.data.reason ?? null,
      admin_notes: body.data.adminNotes ?? null,
      effective_date: body.data.effectiveDate ?? businessDate,
      quote_expiry_date: body.data.quoteExpiryDate ?? null,
      status: "active",
      created_by: session.username,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[amc:quote]", error);
    return badRequest("Failed to create renewal quote");
  }

  invalidateLicenseCache(website.public_id);

  await logActivity(client, {
    eventType:
      quoteType === "permanent_price_change"
        ? ActivityEventTypes.AmcPriceChanged
        : ActivityEventTypes.NegotiatedPriceApplied,
    clientId: website.client_id,
    websiteId,
    actor: session.username,
    description:
      quoteType === "permanent_price_change"
        ? `Permanent annual AMC price changed to ${amount} paise for "${website.name}"`
        : `Negotiated renewal price ${amount} paise applied for "${website.name}"`,
    previousValue: { renewal_price_paise: renewalPrice },
    newValue: mapRenewalQuote(quote),
  });

  return ok(mapRenewalQuote(quote), { status: 201 });
}
