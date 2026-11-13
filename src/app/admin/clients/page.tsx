import { Suspense } from "react";
import { getSupabase } from "@/lib/supabase/server";
import { mapClient } from "@/lib/mappers";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { PageHeader } from "@/components/page-header";
import { ClientTable } from "@/components/clients/client-table";
import { TableSkeleton } from "@/components/loading";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients & Websites" };

export default async function ClientsPage() {
  if (!databaseReady()) {
    return <DatabaseNotice title="Clients & Websites" />;
  }

  const client = getSupabase();
  const { data: clientsData } = await client
    .from("clients")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });

  const clients = (clientsData ?? []).map(mapClient);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Clients & Websites"
        description="One entry, everything. Add the client, website, charges, AMC and status — invoice generates automatically. Open a client to see their websites."
      />
      <Suspense fallback={<TableSkeleton />}>
        <ClientTable clients={clients} />
      </Suspense>
    </div>
  );
}
