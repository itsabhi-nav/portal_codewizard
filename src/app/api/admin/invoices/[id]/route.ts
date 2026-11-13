import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { invoiceUpdateSchema } from "@/lib/validation";
import { mapInvoice, mapInvoiceItem } from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;
  const client = getSupabase();

  const [{ data, error }, { data: items }] = await Promise.all([
    client.from("invoices").select("*, client:clients(*), website:websites(*)").eq("id", id).maybeSingle(),
    client.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order", { ascending: true }),
  ]);

  if (error) return badRequest("Failed to load invoice");
  if (!data) return notFound("Invoice not found");

  const invoice = mapInvoice(data);
  invoice.items = (items ?? []).map(mapInvoiceItem);
  return ok(invoice);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, invoiceUpdateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: previous } = await client.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!previous) return notFound("Invoice not found");

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.data)) {
    if (value !== undefined) patch[key] = value;
  }

  const { data, error } = await client.from("invoices").update(patch).eq("id", id).select("*").single();
  if (error) return badRequest("Failed to update invoice");

  await logActivity(client, {
    eventType: ActivityEventTypes.InvoiceCreated,
    clientId: data.client_id,
    websiteId: data.website_id,
    actor: session.username,
    description: `Invoice ${data.invoice_number} updated`,
    previousValue: mapInvoice(previous),
    newValue: mapInvoice(data),
  });

  return ok(mapInvoice(data));
}
