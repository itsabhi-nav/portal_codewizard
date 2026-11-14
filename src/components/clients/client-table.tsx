"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Pencil, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { LoadErrorNotice, TableSkeleton } from "@/components/loading";
import { RemoveRecordButton } from "@/components/remove-record-button";
import { UnifiedEntryDialog } from "@/components/clients/unified-entry-dialog";
import { WhatsAppButton } from "@/components/whatsapp-button";
import type { Client } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export function ClientTable({ clients }: { clients: Client[] }) {
  const searchParams = useSearchParams();
  const [pageSize] = useState(20);
  const [items, setItems] = useState<Client[]>(() => clients.slice(0, pageSize));
  const [total, setTotal] = useState(clients.length);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const lastLoadedQuery = useRef(JSON.stringify([1, "", false]));

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        archived: String(showArchived),
        sort: "name",
        order: "asc",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const response = await fetch(`/api/admin/clients?${params}`, { signal });
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
  }, [page, pageSize, debouncedSearch, showArchived]);

  useEffect(() => {
    const queryKey = JSON.stringify([page, debouncedSearch, showArchived]);
    if (queryKey === lastLoadedQuery.current) return;
    lastLoadedQuery.current = queryKey;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, page, debouncedSearch, showArchived]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setAddOpen(true);
  }, [searchParams]);

  // Support deep-links like /admin/clients?edit=<id> from the client detail page.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || items.length === 0) return;
    const found = items.find((item) => item.id === editId);
    if (found) {
      setEditing(found);
      setEditOpen(true);
    }
  }, [searchParams, items]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
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
            placeholder="Search clients…"
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <Switch checked={showArchived} onCheckedChange={(checked) => { setShowArchived(checked); setPage(1); }} />
            Show archived
          </label>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Entry
          </Button>
        </div>
      </div>

      {loadError && <div className="px-4"><LoadErrorNotice message={loadError} onRetry={load} /></div>}

      {loading && items.length === 0 ? (
        <div className="p-4">
          <TableSkeleton />
        </div>
      ) : items.length === 0 && !loadError ? (
        <EmptyState
          title="No clients found"
          description="Add your first client to start tracking websites, payments and AMC."
          icon={<MessageCircle className="h-6 w-6" />}
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Entry
            </Button>
          }
        />
      ) : items.length > 0 ? (
        <>
          {/* Phones: compact record cards instead of a sideways-scrolling table */}
          <div className="divide-y md:hidden">
            {items.map((client) => (
              <div key={client.id} className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/clients/${client.id}`} className="block truncate font-medium hover:text-primary">
                      {client.name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">{client.clientCode}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <WhatsAppButton
                      number={client.whatsappNumber || client.mobile}
                      message={`Hello ${client.name}, this is a message from CodeWizard regarding your website.`}
                      label="Chat"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing(client);
                        setEditOpen(true);
                      }}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <RemoveRecordButton entity="client" id={client.id} name={client.name} onDone={load} />
                  </div>
                </div>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p className="truncate">
                    <span className="text-foreground">{client.contactPerson || "—"}</span>
                    {client.businessName ? ` · ${client.businessName}` : ""}
                  </p>
                  <p>
                    {client.mobile || "—"} · Added {new Date(client.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link href={`/admin/clients/${client.id}`} className="font-medium hover:text-primary">
                        {client.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{client.clientCode}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{client.contactPerson || "—"}</p>
                      <p className="text-xs text-muted-foreground">{client.businessName || "—"}</p>
                    </TableCell>
                    <TableCell className="text-sm">{client.mobile || "—"}</TableCell>
                    <TableCell>
                      <WhatsAppButton
                        number={client.whatsappNumber || client.mobile}
                        message={`Hello ${client.name}, this is a message from CodeWizard regarding your website.`}
                        label="Chat"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(client.createdAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(client);
                            setEditOpen(true);
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <RemoveRecordButton entity="client" id={client.id} name={client.name} onDone={load} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 border-t p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:text-sm">
            <p>
              {total} client{total === 1 ? "" : "s"}
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

      <UnifiedEntryDialog open={addOpen} onOpenChange={setAddOpen} clients={clients} onSuccess={load} />
      <UnifiedEntryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        clients={clients}
        editingClient={editing}
        onSuccess={load}
      />
    </Card>
  );
}
