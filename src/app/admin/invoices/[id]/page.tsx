import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { getSupabase } from "@/lib/supabase/server";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { mapClient, mapInvoice, mapInvoiceItem, mapPayment, mapWebsite } from "@/lib/mappers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { InvoiceStatusControl } from "@/components/invoices/invoice-status-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { formatDateIST, formatDateTimeIST } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice Details" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!databaseReady()) {
    return <DatabaseNotice title="Invoice details" />;
  }

  const client = getSupabase();

  const { data: invoiceRow, error: invoiceError } = await client.from("invoices").select("*").eq("id", id).maybeSingle();
  if (invoiceError || !invoiceRow) notFound();

  const [{ data: items }, { data: clientRow }, { data: websiteRow }, { data: paymentsRes }] = await Promise.all([
    client.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order", { ascending: true }),
    client.from("clients").select("*").eq("id", invoiceRow.client_id).maybeSingle(),
    invoiceRow.website_id
      ? client.from("websites").select("*").eq("id", invoiceRow.website_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("payments").select("*").eq("invoice_id", id).order("created_at", { ascending: false }),
  ]);

  const invoice = mapInvoice(invoiceRow);
  invoice.items = (items ?? []).map(mapInvoiceItem);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/invoices">
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {invoice.invoiceType.replace(/_/g, " ")} · Issued {formatDateIST(invoice.issueDate)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusControl invoiceId={invoice.id} status={invoice.status} />
          <a href={`/api/admin/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill To</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{clientRow ? mapClient(clientRow).name : "—"}</p>
            {clientRow && (
              <>
                <p className="text-muted-foreground">{mapClient(clientRow).contactPerson}</p>
                <p className="text-muted-foreground">{mapClient(clientRow).email}</p>
                <p className="text-muted-foreground">{mapClient(clientRow).mobile}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <SummaryRow label="Subtotal" value={formatINR(invoice.subtotalPaise)} />
            <SummaryRow label="Tax" value={formatINR(invoice.taxPaise)} />
            <SummaryRow label="Total" value={formatINR(invoice.totalPaise)} strong />
            <SummaryRow label="Paid" value={formatINR(invoice.amountPaidPaise)} />
            <SummaryRow label="Balance" value={formatINR(Math.max(0, invoice.totalPaise - invoice.amountPaidPaise))} />
            <div className="pt-2">
              <StatusBadge status={invoice.status} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <SummaryRow label="Issue Date" value={formatDateIST(invoice.issueDate)} />
            <SummaryRow label="Due Date" value={formatDateIST(invoice.dueDate)} />
            <SummaryRow label="Website" value={websiteRow ? mapWebsite(websiteRow).name : "—"} />
            <SummaryRow label="Created" value={formatDateTimeIST(invoice.createdAt)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatINR(item.unitPricePaise)}</TableCell>
                  <TableCell className="text-right">{item.taxRatePercent}%</TableCell>
                  <TableCell className="text-right">{formatINR(item.amountPaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {(paymentsRes ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No payments linked to this invoice.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(paymentsRes ?? []).map((payment) => {
                  const mapped = mapPayment(payment);
                  return (
                    <TableRow key={mapped.id}>
                      <TableCell className="font-medium">{mapped.paymentCode}</TableCell>
                      <TableCell>{formatDateIST(mapped.paymentDate ?? mapped.createdAt)}</TableCell>
                      <TableCell>{mapped.method.replace(/_/g, " ")}</TableCell>
                      <TableCell>{formatINR(mapped.amountPaise)}</TableCell>
                      <TableCell>
                        <StatusBadge status={mapped.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
