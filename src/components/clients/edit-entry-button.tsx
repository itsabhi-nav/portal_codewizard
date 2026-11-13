"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedEntryDialog } from "@/components/clients/unified-entry-dialog";
import type { Client } from "@/lib/types";

/**
 * One "Edit" button that edits the client + all of their website details
 * (charges, AMC, status, domain) in the single unified entry dialog —
 * the exact same form used for creating an entry.
 */
export function EditEntryButton({ client, label }: { client: Client; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" /> {label ?? "Edit"}
      </Button>
      <UnifiedEntryDialog
        open={open}
        onOpenChange={setOpen}
        clients={[client]}
        editingClient={client}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
