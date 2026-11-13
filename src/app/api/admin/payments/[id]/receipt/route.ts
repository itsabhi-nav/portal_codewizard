import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { notFound, unauthorized } from "@/lib/api";
import { mapClient, mapPayment, mapWebsite } from "@/lib/mappers";
import { generateReceiptPdf } from "@/lib/pdf";
import { getAppSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;
  const client = getSupabase();

  const [{ data: paymentRow }, settings] = await Promise.all([
    client.from("payments").select("*").eq("id", id).maybeSingle(),
    getAppSettings(client),
  ]);

  if (!paymentRow) return notFound("Payment not found");

  const { data: clientRow } = await client.from("clients").select("*").eq("id", paymentRow.client_id).maybeSingle();
  const { data: websiteRow } = paymentRow.website_id
    ? await client.from("websites").select("*").eq("id", paymentRow.website_id).maybeSingle()
    : { data: null };

  const pdf = await generateReceiptPdf(
    mapPayment(paymentRow),
    clientRow ? mapClient(clientRow) : null,
    websiteRow ? mapWebsite(websiteRow) : null,
    settings
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${paymentRow.payment_code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
