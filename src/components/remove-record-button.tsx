"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Archive, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type RemovableRecord = "client" | "website";

interface RemoveRecordButtonProps {
  entity: RemovableRecord;
  id: string;
  name: string;
  /** Where to navigate after a successful action. Omit to just refresh the current page. */
  redirectTo?: string;
  onDone?: () => void;
  /** Show text next to the icon (used on detail pages). */
  withLabel?: boolean;
}

/**
 * One dustbin button used everywhere for removing a client or website.
 * Clicking it opens a dialog that lets you choose:
 *  1. Archive — hide it, keep everything (history preserved)
 *  2. Delete permanently — hard-delete if empty, otherwise auto-archived
 */
export function RemoveRecordButton({
  entity,
  id,
  name,
  redirectTo,
  onDone,
  withLabel = false,
}: RemoveRecordButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"archive" | "delete">("archive");
  const [busy, setBusy] = useState(false);

  const isArchive = mode === "archive";

  const entityLabel = entity === "client" ? "client" : "website";
  const endpoint = entity === "client" ? "/api/admin/clients" : "/api/admin/websites";

  async function run() {
    setBusy(true);
    try {
      const url = `${endpoint}/${id}${isArchive ? "?mode=archive" : ""}`;
      const response = await fetch(url, { method: "DELETE" });
      const json = await response.json();
      if (response.ok && json.success) {
        toast.success(json.data?.message ?? "Done");
        setOpen(false);
        onDone?.();
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      } else {
        toast.error(json?.error?.message ?? "Something went wrong");
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={withLabel ? "outline" : "ghost"}
        size={withLabel ? "default" : "icon"}
        onClick={() => {
          setMode("archive");
          setOpen(true);
        }}
        title="Remove"
      >
        <Trash2 className={cn(withLabel ? "mr-2 h-4 w-4" : "h-4 w-4", "text-destructive")} />
        {withLabel && <span>Remove</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this {entityLabel}?</DialogTitle>
            <DialogDescription className="line-clamp-1">
              “{name}”
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Archive option */}
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors",
                isArchive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <input
                type="radio"
                name="remove-mode"
                value="archive"
                checked={isArchive}
                onChange={() => setMode("archive")}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  Archive (recommended)
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hide it from the default list. <b>Nothing is deleted</b> — all payments, invoices, and AMC history are preserved, and you can always bring it back with the “Show archived” toggle.
                </p>
              </div>
            </label>

            {/* Delete option */}
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors",
                !isArchive
                  ? "border-destructive bg-destructive/5"
                  : "border-border hover:border-destructive/40"
              )}
            >
              <input
                type="radio"
                name="remove-mode"
                value="delete"
                checked={!isArchive}
                onChange={() => setMode("delete")}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete permanently
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hard-deletes everything — <b>but only if there is no financial history</b> (no payments, invoices or AMC). If it has any records, it will be <b>archived instead</b> automatically so history is never lost.
                </p>
              </div>
            </label>

            {!isArchive && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Deleting is permanent and cannot be undone. If it has any payments, invoices or AMC periods it cannot be hard-deleted — Archive will happen automatically instead.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={isArchive ? "default" : "destructive"}
              onClick={run}
              disabled={busy}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isArchive ? "Archive" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
