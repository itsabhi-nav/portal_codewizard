import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { notFound, unauthorized } from "@/lib/api";
import { mapClient, mapInvoice, mapInvoiceItem, mapWebsite } from "@/lib/mappers";
import { generateInvoicePdf } from "@/lib/pdf";
import { getAppSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;
  const client = getSupabase();

  const [{ data: invoiceRow }, { data: items }, settings] = await Promise.all([
    client.from("invoices").select("*").eq("id", id).maybeSingle(),
    client.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order", { ascending: true }),
    getAppSettings(client),
  ]);

  if (!invoiceRow) return notFound("Invoice not found");

  const { data: clientRow } = await client.from("clients").select("*").eq("id", invoiceRow.client_id).maybeSingle();
  const { data: websiteRow } = invoiceRow.website_id
    ? await client.from("websites").select("*").eq("id", invoiceRow.website_id).maybeSingle()
    : { data: null };

  const invoice = mapInvoice(invoiceRow);
  invoice.items = (items ?? []).map(mapInvoiceItem);

  const pdf = await generateInvoicePdf(
    invoice,
    clientRow ? mapClient(clientRow) : null,
    websiteRow ? mapWebsite(websiteRow) : null,
    settings
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
