import { Suspense } from "react";
import { getSupabase } from "@/lib/supabase/server";
import { mapClient } from "@/lib/mappers";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { PageHeader } from "@/components/page-header";
import { PaymentTable } from "@/components/payments/payment-table";
import { PaymentBalanceTable, type BalanceRow } from "@/components/payments/payment-balance-table";
import { TableSkeleton } from "@/components/loading";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments & Finance" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; websiteId?: string }>;
}) {
  if (!databaseReady()) {
    return <DatabaseNotice title="Payments & Finance" />;
  }

  const { clientId, websiteId } = await searchParams;
  const client = getSupabase();
  const [clientsRes, websitesRes, chargeRowsRes, paymentsRes] = await Promise.all([
    client.from("clients").select("*").eq("archived", false).order("name", { ascending: true }),
    client.from("websites").select("id, client_id, name").eq("archived", false),
    client
      .from("websites")
      .select("client_id, development_cost_paise, domain_charge_paise, hosting_charge_paise")
      .eq("archived", false),
    client.from("payments").select("client_id, amount_paise").eq("status", "successful"),
  ]);

  const clients = (clientsRes.data ?? []).map(mapClient);
  const websites = (websitesRes.data ?? []).map((w) => ({ id: w.id, clientId: w.client_id, name: w.name }));

  const chargedByClient = new Map<string, { total: number; count: number }>();
  for (const row of chargeRowsRes.data ?? []) {
    const sum =
      Number(row.development_cost_paise ?? 0) +
      Number(row.domain_charge_paise ?? 0) +
      Number(row.hosting_charge_paise ?? 0);
    const entry = chargedByClient.get(row.client_id) ?? { total: 0, count: 0 };
    entry.total += sum;
    entry.count += 1;
    chargedByClient.set(row.client_id, entry);
  }
  const paidByClient = new Map<string, number>();
  for (const row of paymentsRes.data ?? []) {
    paidByClient.set(row.client_id, (paidByClient.get(row.client_id) ?? 0) + Number(row.amount_paise ?? 0));
  }
  const rows: BalanceRow[] = clients.map((c) => {
    const charged = chargedByClient.get(c.id) ?? { total: 0, count: 0 };
    const paid = paidByClient.get(c.id) ?? 0;
    return {
      clientId: c.id,
      clientName: c.name,
      websiteCount: charged.count,
      totalPaise: charged.total,
      paidPaise: paid,
      pendingPaise: Math.max(0, charged.total - paid),
    };
  });

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Client-wise outstanding — add a client with Add Entry, this page shows what they owe. Record a payment and an invoice is generated automatically."
      />
      <Suspense fallback={<TableSkeleton />}>
        <PaymentBalanceTable clients={clients} websites={websites} rows={rows} />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <PaymentTable
          clients={clients}
          websites={websites}
          initialClientId={clientId ?? ""}
          initialWebsiteId={websiteId ?? ""}
        />
      </Suspense>
    </div>
  );
}
