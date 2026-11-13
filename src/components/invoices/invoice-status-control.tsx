"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";

const STATUSES = ["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"];

export function InvoiceStatusControl({ invoiceId, status }: { invoiceId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function update(next: string) {
    setValue(next);
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await response.json();
      if (json.success) {
        toast.success("Invoice status updated");
        router.refresh();
      } else {
        toast.error(json?.error?.message ?? "Failed to update status");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      <Select value={value} onChange={(event) => update(event.target.value)} disabled={saving} className="w-44">
        {STATUSES.map((statusValue) => (
          <option key={statusValue} value={statusValue}>
            {statusValue.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </option>
        ))}
      </Select>
      {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
