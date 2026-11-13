import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { escapeSearch, ok, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Global search across clients, websites, invoices and payments.
 * Returns a compact result set for the top navigation search box.
 */
export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return ok({ results: [] });

  const escaped = escapeSearch(query);
  const client = getSupabase();

  const [clients, websites, invoices, payments] = await Promise.all([
    client
      .from("clients")
      .select("id, name, business_name, mobile, client_code")
      .or(`name.ilike.%${escaped}%,business_name.ilike.%${escaped}%,mobile.ilike.%${escaped}%,client_code.ilike.%${escaped}%`)
      .limit(5),
    client
      .from("websites")
      .select("id, name, public_id, status")
      .or(`name.ilike.%${escaped}%,public_id.ilike.%${escaped}%`)
      .limit(5),
    client
      .from("invoices")
      .select("id, invoice_number, status, total_paise")
      .ilike("invoice_number", `%${escaped}%`)
      .limit(5),
    client
      .from("payments")
      .select("id, payment_code, transaction_ref, razorpay_payment_id, status")
      .or(
        `payment_code.ilike.%${escaped}%,transaction_ref.ilike.%${escaped}%,razorpay_payment_id.ilike.%${escaped}%`
      )
      .limit(5),
  ]);

  const results = [
    ...(clients.data ?? []).map((row) => ({
      type: "client" as const,
      id: row.id,
      title: row.name,
      subtitle: row.business_name || row.client_code,
      href: `/admin/clients/${row.id}`,
    })),
    ...(websites.data ?? []).map((row) => ({
      type: "website" as const,
      id: row.id,
      title: row.name,
      subtitle: `${row.public_id} • ${row.status}`,
      href: `/admin/websites/${row.id}`,
    })),
    ...(invoices.data ?? []).map((row) => ({
      type: "invoice" as const,
      id: row.id,
      title: row.invoice_number,
      subtitle: `Invoice • ${row.status}`,
      href: `/admin/invoices/${row.id}`,
    })),
    ...(payments.data ?? []).map((row) => ({
      type: "payment" as const,
      id: row.id,
      title: row.payment_code,
      subtitle: row.transaction_ref || row.razorpay_payment_id || row.status,
      href: `/admin/payments`,
    })),
  ];

  return ok({ results });
}
