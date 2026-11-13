import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { getSupabase } from "@/lib/supabase/server";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { formatINR } from "@/lib/money";
import { formatDateTimeIST } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transactions" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; websiteId?: string }>;
}) {
  const { status, websiteId } = await searchParams;
  if (!databaseReady()) {
    return <DatabaseNotice title="Transactions" />;
  }

  const client = getSupabase();

  let query = client
    .from("razorpay_orders")
    .select("*, payment:payments(*), website:websites(id, name), client:clients(id, name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (websiteId) query = query.eq("website_id", websiteId);

  const { data: orders } = await query;

  const { data: webhooks } = await client
    .from("razorpay_webhook_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Transactions"
        description="Reconcile Razorpay orders, payments and webhook events."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Razorpay Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {(orders ?? []).length === 0 ? (
            <EmptyState
              title="No transactions"
              description="Online renewal orders will appear here."
              icon={<ArrowLeftRight className="h-6 w-6" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Order Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orders ?? []).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.order_id}</TableCell>
                      <TableCell className="text-sm">
                        {order.website ? (
                          <Link href={`/admin/websites/${order.website.id}`} className="text-primary hover:underline">
                            {order.website.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{order.client?.name ?? "—"}</TableCell>
                      <TableCell>{formatINR(Number(order.amount_paise))}</TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        {order.payment ? (
                          <div>
                            <p className="text-sm">{order.payment.payment_code}</p>
                            <StatusBadge status={order.payment.status} />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTimeIST(order.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Webhook Events</CardTitle>
        </CardHeader>
        <CardContent>
          {(webhooks ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No webhook events received yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Event ID</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(webhooks ?? []).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-sm">{event.event_name}</TableCell>
                    <TableCell className="font-mono text-xs">{event.event_id}</TableCell>
                    <TableCell className="font-mono text-xs">{event.order_id ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={event.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTimeIST(event.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
