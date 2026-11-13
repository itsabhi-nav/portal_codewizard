import { Suspense } from "react";
import { getSupabase } from "@/lib/supabase/server";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { mapClient } from "@/lib/mappers";
import { PageHeader } from "@/components/page-header";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { TableSkeleton } from "@/components/loading";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  if (!databaseReady()) {
    return <DatabaseNotice title="Invoices" />;
  }

  const client = getSupabase();
  const [clientsRes, websitesRes] = await Promise.all([
    client.from("clients").select("*").eq("archived", false).order("name", { ascending: true }),
    client.from("websites").select("id, client_id, name").eq("archived", false),
  ]);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create and track development, AMC and additional service invoices."
      />
      <Suspense fallback={<TableSkeleton />}>
        <InvoiceTable
          clients={(clientsRes.data ?? []).map(mapClient)}
          websites={(websitesRes.data ?? []).map((w) => ({ id: w.id, clientId: w.client_id, name: w.name }))}
        />
      </Suspense>
    </div>
  );
}
