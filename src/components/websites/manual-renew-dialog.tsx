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
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/form-field";

const schema = z.object({
  amount: z.string().min(1, "Amount is required"),
  effectiveDate: z.string().optional(),
  paymentMethod: z.enum(["razorpay", "upi", "bank_transfer", "cash", "other"]),
  transactionRef: z.string().optional(),
  notes: z.string().optional(),
});

export function ManualRenewDialog({
  open,
  onOpenChange,
  websiteId,
  defaultAmount,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  defaultAmount?: number;
  onSuccess?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { paymentMethod: "other" },
  });

  useEffect(() => {
    if (open) {
      reset({
        amount: defaultAmount ? String(defaultAmount / 100) : "",
        effectiveDate: new Date().toISOString().slice(0, 10),
        paymentMethod: "other",
        transactionRef: "",
        notes: "",
      });
    }
  }, [open, defaultAmount, reset]);

  async function onSubmit(values: z.infer<typeof schema>) {
    const response = await fetch(`/api/admin/amc/${websiteId}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: values.amount,
        effectiveDate: values.effectiveDate || undefined,
        paymentMethod: values.paymentMethod,
        transactionRef: values.transactionRef || null,
        notes: values.notes || null,
      }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      toast.error(json?.error?.message ?? "Failed to record renewal");
      return;
    }
    toast.success("Renewal recorded and website reactivated");
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Manual Renewal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldRow>
            <Field label="Amount (INR)" required error={errors.amount?.message}>
              <Input {...register("amount")} placeholder="3000" />
            </Field>
            <Field label="Effective Date" error={errors.effectiveDate?.message}>
              <Input type="date" {...register("effectiveDate")} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Payment Method" required>
              <Select {...register("paymentMethod")}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="razorpay">Razorpay</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Reference" error={errors.transactionRef?.message}>
              <Input {...register("transactionRef")} />
            </Field>
          </FieldRow>
          <Field label="Notes" error={errors.notes?.message}>
            <Input {...register("notes")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Renewal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
