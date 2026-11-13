"use client";

import { useMemo, useState } from "react";
import { Search, CheckCircle2, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { RecordPaymentButton, PaymentHistoryLink } from "@/components/payments/record-payment-button";
import { formatINR } from "@/lib/money";
import type { Client } from "@/lib/types";

export interface BalanceRow {
  clientId: string;
  clientName: string;
  websiteCount: number;
  totalPaise: number;
  paidPaise: number;
  pendingPaise: number;
}

/**
 * Per-client money summary: what the client was charged (development + domain +
 * hosting & AMC), what they have paid, and what is still pending. Everything
 * is computed live, so editing a charge anywhere updates this instantly.
 */
export function PaymentBalanceTable({
  clients,
  websites,
  rows,
}: {
  clients: Client[];
  websites: Array<{ id: string; clientId: string; name: string }>;
  rows: BalanceRow[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.clientName.toLowerCase().includes(q));
  }, [rows, search]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => ({
          total: acc.total + row.totalPaise,
          paid: acc.paid + row.paidPaise,
          pending: acc.pending + row.pendingPaise,
        }),
        { total: 0, paid: 0, pending: 0 }
      ),
    [filtered]
  );

  return (
    <Card className="mb-6">
      <div className="space-y-3 border-b p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Scale className="h-4 w-4 text-primary" />
              Outstanding
            </h2>
            <p className="text-xs text-muted-foreground">
              Client-wise total charged, paid and pending. Updates live on every charge edit and payment.
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Search client…"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-muted-foreground">
            Total: <b className="text-foreground">{formatINR(totals.total)}</b>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400">
            Paid: <b>{formatINR(totals.paid)}</b>
          </span>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${totals.pending > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
            Pending: <b>{formatINR(totals.pending)}</b>
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "No clients yet" : "No matching client"}
          description={
            rows.length === 0
              ? "Add your first client with the Add Entry button — their pending amount will show up here."
              : "Try a different search."
          }
          icon={<Scale className="h-6 w-6" />}
        />
      ) : (
        <>
          <div className="divide-y md:hidden">
            {filtered.map((row) => (
              <div key={row.clientId} className="space-y-2.5 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.clientName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.websiteCount} website{row.websiteCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <RecordPaymentButton
                      clientId={row.clientId}
                      clients={clients}
                      websites={websites}
                      defaultAmountPaise={row.pendingPaise > 0 ? row.pendingPaise : undefined}
                      purpose="advance"
                      size="sm"
                      label="Payment"
                    />
                    <PaymentHistoryLink clientId={row.clientId} size="sm" label="History" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="text-xs font-semibold tabular-nums">{formatINR(row.totalPaise)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid</p>
                    <p className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatINR(row.paidPaise)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</p>
                    {row.pendingPaise > 0 ? (
                      <p className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                        {formatINR(row.pendingPaise)}
                      </p>
                    ) : (
                      <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Settled
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.clientId}>
                    <TableCell>
                      <p className="font-medium">{row.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.websiteCount} website{row.websiteCount === 1 ? "" : "s"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.totalPaise)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatINR(row.paidPaise)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.pendingPaise > 0 ? (
                        <span className="font-semibold text-amber-700 dark:text-amber-400">{formatINR(row.pendingPaise)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> Settled
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <RecordPaymentButton
                          clientId={row.clientId}
                          clients={clients}
                          websites={websites}
                          defaultAmountPaise={row.pendingPaise > 0 ? row.pendingPaise : undefined}
                          purpose="advance"
                          size="sm"
                          label="Payment"
                        />
                        <PaymentHistoryLink clientId={row.clientId} size="sm" label="History" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Card>
  );
}
