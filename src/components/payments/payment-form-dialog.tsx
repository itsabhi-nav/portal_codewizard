"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/form-field";
import { PAYMENT_CATEGORY_CHOICES } from "@/lib/payment-categories";
import type { Client } from "@/lib/types";

export interface PaymentWebsiteOption {
  id: string;
  clientId: string;
  name: string;
}

const schema = z.object({
  clientId: z.string().min(1, "Client is required"),
  websiteId: z.string().optional(),
  invoiceId: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  method: z.enum(["razorpay", "upi", "bank_transfer", "cash", "other"]),
  purpose: z.enum([
    "advance",
    "domain",
    "amc_hosting",
    "final_completion",
    "development",
    "amc_renewal",
    "additional_development",
    "hosting",
    "other",
  ]),
  transactionRef: z.string().optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function PaymentFormDialog({
  open,
  onOpenChange,
  clients,
  websites,
  preset,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  websites: PaymentWebsiteOption[];
  preset?: { clientId?: string; websiteId?: string; purpose?: Values["purpose"]; amount?: string };
  onSuccess?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      method: "upi",
      purpose: "advance",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        clientId: preset?.clientId ?? "",
        websiteId: preset?.websiteId ?? "",
        invoiceId: "",
        amount: preset?.amount ?? "",
        method: "upi",
        purpose: preset?.purpose ?? "advance",
        transactionRef: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: "",
      });
    }
  }, [open, preset, reset]);

  async function onSubmit(values: Values) {
    const payload = {
      clientId: values.clientId,
      websiteId: values.websiteId || null,
      invoiceId: values.invoiceId || null,
      amount: values.amount,
      method: values.method,
      purpose: values.purpose,
      status: "successful",
      transactionRef: values.transactionRef || null,
      paymentDate: values.paymentDate ? new Date(values.paymentDate).toISOString() : new Date().toISOString(),
      notes: values.notes || null,
    };

    const response = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      toast.error(json?.error?.message ?? "Failed to record payment");
      return;
    }
    toast.success("Payment recorded");
    onOpenChange(false);
    onSuccess?.();
  }

  const filteredWebsites = preset?.clientId ? websites.filter((w) => w.clientId === preset.clientId) : websites;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldRow>
            <Field label="Client" required error={errors.clientId?.message}>
              <Select {...register("clientId")}>
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Website" error={errors.websiteId?.message}>
              <Select {...register("websiteId")}>
                <option value="">Not linked</option>
                {filteredWebsites.map((website) => (
                  <option key={website.id} value={website.id}>
                    {website.name}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Amount (INR)" required error={errors.amount?.message}>
              <Input {...register("amount")} placeholder="5000" />
            </Field>
            <Field label="Payment Date" error={errors.paymentDate?.message}>
              <Input type="date" {...register("paymentDate")} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Method" required error={errors.method?.message}>
              <Select {...register("method")}>
                <option value="razorpay">Razorpay</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other / Manual</option>
              </Select>
            </Field>
            <Field label="Category" required hint="Invoice is auto-generated for this payment" error={errors.purpose?.message}>
              <Select {...register("purpose")}>
                {PAYMENT_CATEGORY_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldRow>

          <Field label="Transaction Reference" error={errors.transactionRef?.message}>
            <Input {...register("transactionRef")} placeholder="UPI / bank reference (optional)" />
          </Field>

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register("notes")} rows={2} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
