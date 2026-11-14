"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { LoadErrorNotice, TableSkeleton } from "@/components/loading";
import { StatusBadge } from "@/components/status-badge";
import { InvoiceFormDialog } from "@/components/invoices/invoice-form-dialog";
import { formatINR } from "@/lib/money";
import { formatDateIST } from "@/lib/dates";
import type { Client, Invoice } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export function InvoiceTable({
  clients,
  websites,
}: {
  clients: Client[];
  websites: Array<{ id: string; clientId: string; name: string }>;
}) {
  const [items, setItems] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      const response = await fetch(`/api/admin/invoices?${params}`, { signal });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message ?? "Please try again.");
      }
      setItems(json.data.items);
      setTotal(json.data.total);
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, status, type]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <div className="flex flex-col gap-2 border-b p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            {loading ? (
              <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-9"
              placeholder="Search invoice number…"
            />
          </div>
          <Button onClick={() => setDialogOpen(true)} className="w-full sm:ml-auto sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Create Invoice
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-40">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="sm:w-40">
              <option value="">All types</option>
              <option value="development">Development</option>
              <option value="amc">AMC</option>
              <option value="additional_service">Additional Service</option>
              <option value="hosting">Hosting</option>
              <option value="other">Other</option>
            </Select>
          </div>
      </div>

      {loadError && <div className="px-4"><LoadErrorNotice message={loadError} onRetry={load} /></div>}

      {loading && items.length === 0 ? (
        <div className="p-4">
          <TableSkeleton />
        </div>
      ) : items.length === 0 && !loadError ? (
        <EmptyState
          title="No invoices found"
          description="Create development, AMC or additional service invoices."
          icon={<FileText className="h-6 w-6" />}
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </Button>
          }
        />
      ) : items.length > 0 ? (
        <>
          <div className="divide-y md:hidden">
            {items.map((invoice) => (
              <div key={invoice.id} className="space-y-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/invoices/${invoice.id}`} className="block truncate font-medium hover:text-primary">
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="truncate text-[11px] capitalize text-muted-foreground">
                      {invoice.client?.name ?? "—"} · {invoice.invoiceType.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge status={invoice.status} />
                    <a href={`/api/admin/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Download PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {formatDateIST(invoice.issueDate)} → {formatDateIST(invoice.dueDate)}
                  </span>
                  <span className="shrink-0">
                    <span className="font-semibold">{formatINR(invoice.totalPaise)}</span>
                    <span className="text-muted-foreground"> · paid {formatINR(invoice.amountPaidPaise)}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/invoices/${invoice.id}`} className="hover:text-primary">
                        {invoice.invoiceNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{invoice.invoiceType.replace(/_/g, " ")}</p>
                    </TableCell>
                    <TableCell className="text-sm">{invoice.client?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateIST(invoice.issueDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateIST(invoice.dueDate)}</TableCell>
                    <TableCell>{formatINR(invoice.totalPaise)}</TableCell>
                    <TableCell className="text-sm">{formatINR(invoice.amountPaidPaise)}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/invoices/${invoice.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                        <a href={`/api/admin/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="Download PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 border-t p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:text-sm">
            <p>
              {total} invoice{total === 1 ? "" : "s"}
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
      ) : null}

      <InvoiceFormDialog open={dialogOpen} onOpenChange={setDialogOpen} clients={clients} websites={websites} onSuccess={load} />
    </Card>
  );
}
