"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Settings2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatINR } from "@/lib/money";
import { formatDateIST } from "@/lib/dates";

export interface AmcRow {
  contractId: string;
  websiteId: string;
  websiteName: string;
  publicId: string;
  clientId: string;
  clientName: string;
  domain: string | null;
  whatsappNumber: string | null;
  enabled: boolean;
  exempt: boolean;
  status: string;
  accessStatus: string;
  daysRemaining: number | null;
  daysOverdue: number;
  renewalAmountPaise: number;
  negotiatedAmountPaise: number | null;
  validityStart: string | null;
  validityEnd: string | null;
  nextExpiryDate: string | null;
  upcomingThresholdDays: number;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "expired", label: "Expired" },
  { key: "overdue", label: "Overdue" },
  { key: "suspended", label: "Suspended" },
  { key: "exempt", label: "Exempt" },
  { key: "disabled", label: "AMC Disabled" },
] as const;

type SortKey = "expiry" | "client" | "amount" | "daysRemaining" | "daysOverdue";

export function AmcTable({ rows }: { rows: AmcRow[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("expiry");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    let result = rows;
    if (filter !== "all") {
      if (filter === "disabled") {
        result = result.filter((row) => !row.enabled);
      } else if (filter === "suspended") {
        result = result.filter((row) => row.status === "suspended" || row.accessStatus === "suspended" || row.accessStatus === "manual_suspended");
      } else {
        result = result.filter((row) => row.status === filter);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (row) =>
          row.websiteName.toLowerCase().includes(q) ||
          row.clientName.toLowerCase().includes(q) ||
          (row.domain ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case "expiry":
          comparison = (a.nextExpiryDate ?? "").localeCompare(b.nextExpiryDate ?? "");
          break;
        case "client":
          comparison = a.clientName.localeCompare(b.clientName);
          break;
        case "amount":
          comparison = a.renewalAmountPaise - b.renewalAmountPaise;
          break;
        case "daysRemaining":
          comparison = (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
          break;
        case "daysOverdue":
          comparison = a.daysOverdue - b.daysOverdue;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
    return sorted;
  }, [rows, filter, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === item.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search website, client or domain…"
          className="w-full sm:max-w-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No AMC records"
          description="Configure AMC for a website to start tracking renewals."
          icon={<RefreshCw className="h-6 w-6" />}
        />
      ) : (
        <>
          <div className="divide-y md:hidden">
            {filtered.map((row) => (
              <div key={row.contractId} className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/websites/${row.websiteId}?tab=amc`} className="block truncate font-medium hover:text-primary">
                      {row.websiteName}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {row.clientName} · {row.domain ?? row.publicId}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge status={row.status} />
                    <WhatsAppButton
                      number={row.whatsappNumber}
                      message={`Hello ${row.clientName}, this is a reminder about your website ${row.websiteName} annual maintenance renewal of ${formatINR(row.renewalAmountPaise)} due on ${formatDateIST(row.nextExpiryDate)}.`}
                      label=""
                      size="icon"
                      showCopy={false}
                    />
                    <Link href={`/admin/websites/${row.websiteId}?tab=amc`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Configure AMC">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Expiry</p>
                    <p className="text-xs font-medium">{formatDateIST(row.nextExpiryDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Days</p>
                    {row.daysRemaining !== null && row.daysRemaining >= 0 ? (
                      <p className="text-xs font-medium">{row.daysRemaining} left</p>
                    ) : row.daysOverdue > 0 ? (
                      <p className="text-xs font-medium text-destructive">{row.daysOverdue} overdue</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p>
                    <p className="text-xs font-semibold">{formatINR(row.renewalAmountPaise)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("client")}>
                    Client <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Website</TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("expiry")}>
                    Expiry <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Days</TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("amount")}>
                    Renewal Amount <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.contractId}>
                  <TableCell className="text-sm font-medium">{row.clientName}</TableCell>
                  <TableCell>
                    <Link href={`/admin/websites/${row.websiteId}?tab=amc`} className="hover:text-primary">
                      {row.websiteName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.domain ?? row.publicId}</p>
                  </TableCell>
                  <TableCell className="text-sm">{formatDateIST(row.nextExpiryDate)}</TableCell>
                  <TableCell>
                    {row.daysRemaining !== null && row.daysRemaining >= 0 ? (
                      <span className="text-sm">{row.daysRemaining} left</span>
                    ) : row.daysOverdue > 0 ? (
                      <span className="text-sm text-destructive">{row.daysOverdue} overdue</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{formatINR(row.renewalAmountPaise)}</p>
                    {row.negotiatedAmountPaise !== null && row.negotiatedAmountPaise < row.renewalAmountPaise && (
                      <p className="text-xs text-emerald-500">{formatINR(row.negotiatedAmountPaise)} negotiated</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.accessStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <WhatsAppButton
                        number={row.whatsappNumber}
                        message={`Hello ${row.clientName}, this is a reminder about your website ${row.websiteName} annual maintenance renewal of ${formatINR(row.renewalAmountPaise)} due on ${formatDateIST(row.nextExpiryDate)}.`}
                        label="Remind"
                      />
                      <Link href={`/admin/websites/${row.websiteId}?tab=amc`}>
                        <Button variant="ghost" size="icon" title="Configure AMC">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </Link>
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
