"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, CreditCard, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading";
import { StatusBadge } from "@/components/status-badge";
import { PaymentFormDialog } from "@/components/payments/payment-form-dialog";
import { formatINR } from "@/lib/money";
import { formatDateIST } from "@/lib/dates";
import type { Client, Payment } from "@/lib/types";
import type { PaymentWebsiteOption } from "@/components/payments/payment-form-dialog";

export function PaymentTable({
  clients,
  websites,
  initialClientId = "",
  initialWebsiteId = "",
}: {
  clients: Client[];
  websites: PaymentWebsiteOption[];
  initialClientId?: string;
  initialWebsiteId?: string;
}) {
  const [items, setItems] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const [method, setMethod] = useState("");
  const [clientId, setClientId] = useState(initialClientId);
  const [websiteId, setWebsiteId] = useState(initialWebsiteId);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (purpose) params.set("purpose", purpose);
      if (method) params.set("method", method);
      if (clientId) params.set("clientId", clientId);
      if (websiteId) params.set("websiteId", websiteId);
      const response = await fetch(`/api/admin/payments?${params}`);
      const json = await response.json();
      if (json.success) {
        setItems(json.data.items);
        setTotal(json.data.total);
      }
    } catch {
      // Transient API errors leave the table in its empty state.
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, purpose, method, clientId, websiteId]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <div className="flex flex-col gap-2 border-b p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-9"
              placeholder="Search payment code or reference…"
            />
          </div>
          <Button onClick={() => setDialogOpen(true)} className="w-full sm:ml-auto sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Record Payment
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-36">
              <option value="">All statuses</option>
              <option value="successful">Successful</option>
              <option value="pending">Pending</option>
              <option value="created">Created</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="partially_refunded">Partially refunded</option>
            </Select>
            <Select value={purpose} onChange={(e) => { setPurpose(e.target.value); setPage(1); }} className="sm:w-44">
              <option value="">All purposes</option>
              <option value="development">Development</option>
              <option value="amc_renewal">AMC Renewal</option>
              <option value="additional_development">Additional Dev</option>
              <option value="hosting">Hosting</option>
              <option value="other">Other</option>
            </Select>
            <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className="sm:w-40">
              <option value="">All methods</option>
              <option value="razorpay">Razorpay</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </Select>
            <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }} className="sm:w-44">
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            <Select value={websiteId} onChange={(e) => { setWebsiteId(e.target.value); setPage(1); }} className="col-span-2 sm:col-span-1 sm:w-44">
              <option value="">All websites</option>
              {websites.map((website) => (
                <option key={website.id} value={website.id}>
                  {website.name}
                </option>
              ))}
            </Select>
          </div>
      </div>

      {loading ? (
        <div className="p-4">
          <TableSkeleton />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No payments found"
          description="Record development payments, advances and AMC renewals."
          icon={<CreditCard className="h-6 w-6" />}
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Record Payment
            </Button>
          }
        />
      ) : (
        <>
          <div className="divide-y md:hidden">
            {items.map((payment) => (
              <div key={payment.id} className="space-y-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payment.paymentCode}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {payment.client?.name ?? "—"}
                      {payment.transactionRef ? ` · ${payment.transactionRef}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusBadge status={payment.status} />
                    {payment.status === "successful" && (
                      <a href={`/api/admin/payments/${payment.id}/receipt`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Download receipt">
                          <Receipt className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs capitalize text-muted-foreground">
                    {payment.purpose.replace(/_/g, " ")} · {payment.method.replace(/_/g, " ")}
                  </p>
                  <p className="shrink-0 text-sm font-semibold">{formatINR(payment.amountPaise)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatDateIST(payment.paymentDate ?? payment.createdAt)}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      <p>{payment.paymentCode}</p>
                      {payment.transactionRef && (
                        <p className="text-xs text-muted-foreground">{payment.transactionRef}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{payment.client?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateIST(payment.paymentDate ?? payment.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{payment.purpose.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{payment.method.replace(/_/g, " ")}</TableCell>
                    <TableCell className="font-medium">{formatINR(payment.amountPaise)}</TableCell>
                    <TableCell>
                      <StatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.status === "successful" && (
                        <a href={`/api/admin/payments/${payment.id}/receipt`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="Download receipt">
                            <Receipt className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 border-t p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:text-sm">
            <p>
              {total} payment{total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <PaymentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clients={clients}
        websites={websites}
        preset={{ clientId: clientId || undefined, websiteId: websiteId || undefined }}
        onSuccess={load}
      />
    </Card>
  );
}
