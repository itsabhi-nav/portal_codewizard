"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentFormDialog } from "@/components/payments/payment-form-dialog";
import type { PaymentPurpose } from "@/lib/payment-categories";
import type { Client } from "@/lib/types";

export interface RecordPaymentOption {
  id: string;
  clientId: string;
  name: string;
}

/**
 * One-click payment actions for a record:
 * - "Record Payment" opens the manual payment dialog (Razorpay is automatic on renewal).
 * - "History" opens the payment history filtered to this record.
 */
export function RecordPaymentButton({
  clientId,
  websiteId,
  clients,
  websites,
  defaultAmountPaise,
  purpose,
  size = "default",
  label = "Payment",
}: {
  clientId: string;
  websiteId?: string;
  clients: Client[];
  websites: RecordPaymentOption[];
  defaultAmountPaise?: number;
  purpose?: PaymentPurpose;
  size?: "sm" | "default";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Record {label}
      </Button>
      <PaymentFormDialog
        open={open}
        onOpenChange={setOpen}
        clients={clients}
        websites={websites.filter((w) => w.clientId === clientId)}
        preset={{
          clientId,
          websiteId,
          purpose: purpose ?? "advance",
          amount: defaultAmountPaise ? String(defaultAmountPaise / 100) : undefined,
        }}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

export function PaymentHistoryLink({
  clientId,
  websiteId,
  size = "default",
  label = "History",
}: {
  clientId?: string;
  websiteId?: string;
  size?: "sm" | "default";
  label?: string;
}) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", clientId);
  if (websiteId) params.set("websiteId", websiteId);
  const href = `/admin/payments${params.toString() ? `?${params}` : ""}`;
  return (
    <Link href={href}>
      <Button variant="outline" size={size}>
        <History className="mr-2 h-4 w-4" /> {label}
      </Button>
    </Link>
  );
}
