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
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/form-field";
import type { AmcContract } from "@/lib/types";

const configureSchema = z.object({
  enabled: z.boolean(),
  exempt: z.boolean(),
  originalPrice: z.string().optional(),
  renewalPrice: z.string().min(1, "Renewal price is required"),
  negotiatedPrice: z.string().optional(),
  billingPeriodDays: z.string().optional(),
  upcomingThresholdDays: z.string().optional(),
  gracePeriodDays: z.string().optional(),
  validityStart: z.string().optional(),
  validityEnd: z.string().optional(),
});

export function AmcConfigDialog({
  open,
  onOpenChange,
  websiteId,
  contract,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  contract: AmcContract | null;
  onSuccess?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof configureSchema>>({
    resolver: zodResolver(configureSchema),
    defaultValues: {
      enabled: true,
      exempt: false,
      billingPeriodDays: "365",
      upcomingThresholdDays: "10",
      gracePeriodDays: "3",
    },
  });

  const enabled = watch("enabled");
  const exempt = watch("exempt");

  useEffect(() => {
    if (open) {
      reset({
        enabled: contract?.enabled ?? true,
        exempt: contract?.exempt ?? false,
        originalPrice: contract ? String(contract.originalPricePaise / 100) : "",
        renewalPrice: contract ? String(contract.renewalPricePaise / 100) : "",
        negotiatedPrice: contract?.negotiatedPricePaise ? String(contract.negotiatedPricePaise / 100) : "",
        billingPeriodDays: String(contract?.billingPeriodDays ?? 365),
        upcomingThresholdDays: String(contract?.upcomingThresholdDays ?? 10),
        gracePeriodDays: String(contract?.gracePeriodDays ?? 3),
        validityStart: contract?.validityStart ?? new Date().toISOString().slice(0, 10),
        validityEnd: contract?.validityEnd ?? "",
      });
    }
  }, [open, contract, reset]);

  async function onSubmit(values: z.infer<typeof configureSchema>) {
    const response = await fetch(`/api/admin/websites/${websiteId}/amc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: values.enabled,
        exempt: values.exempt,
        originalPrice: values.originalPrice || "0",
        renewalPrice: values.renewalPrice || "0",
        negotiatedPrice: values.negotiatedPrice || null,
        billingPeriodDays: Number(values.billingPeriodDays ?? 365),
        upcomingThresholdDays: Number(values.upcomingThresholdDays ?? 10),
        gracePeriodDays: Number(values.gracePeriodDays ?? 3),
        validityStart: values.validityStart || null,
        validityEnd: values.validityEnd || null,
      }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      toast.error(json?.error?.message ?? "Failed to configure AMC");
      return;
    }
    toast.success("AMC configured");
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure AMC</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch name="enabled" checked={enabled} onCheckedChange={(checked) => reset({ ...watch(), enabled: checked })} />
              AMC Enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch name="exempt" checked={exempt} onCheckedChange={(checked) => reset({ ...watch(), exempt: checked })} />
              Exempt from AMC
            </label>
          </div>

          <FieldRow>
            <Field label="Original Annual Price (INR)" error={errors.originalPrice?.message}>
              <Input {...register("originalPrice")} placeholder="3000" />
            </Field>
            <Field label="Renewal Price (INR)" required error={errors.renewalPrice?.message}>
              <Input {...register("renewalPrice")} placeholder="3000" />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Negotiated Price (INR)" error={errors.negotiatedPrice?.message} hint="Optional one-time discount">
              <Input {...register("negotiatedPrice")} placeholder="2000" />
            </Field>
            <Field label="Billing Period (days)" error={errors.billingPeriodDays?.message}>
              <Input type="number" {...register("billingPeriodDays")} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Upcoming Threshold (days)" error={errors.upcomingThresholdDays?.message}>
              <Input type="number" {...register("upcomingThresholdDays")} />
            </Field>
            <Field label="Grace Period (days)" error={errors.gracePeriodDays?.message}>
              <Input type="number" {...register("gracePeriodDays")} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Validity Start" error={errors.validityStart?.message}>
              <Input type="date" {...register("validityStart")} />
            </Field>
            <Field label="Validity End" error={errors.validityEnd?.message} hint="Leave blank to auto-calculate">
              <Input type="date" {...register("validityEnd")} />
            </Field>
          </FieldRow>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save AMC
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const extendSchema = z.object({
  newValidityEnd: z.string().min(1, "New validity end date is required"),
  reason: z.string().optional(),
});

export function AmcExtendDialog({
  open,
  onOpenChange,
  websiteId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  onSuccess?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof extendSchema>>({ resolver: zodResolver(extendSchema) });

  useEffect(() => {
    if (open) reset({ newValidityEnd: "", reason: "" });
  }, [open, reset]);

  async function onSubmit(values: z.infer<typeof extendSchema>) {
    const response = await fetch(`/api/admin/websites/${websiteId}/amc/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      toast.error(json?.error?.message ?? "Failed to extend validity");
      return;
    }
    toast.success("Validity extended");
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend AMC Validity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="New Validity End Date" required error={errors.newValidityEnd?.message}>
            <Input type="date" {...register("newValidityEnd")} />
          </Field>
          <Field label="Reason (optional)" error={errors.reason?.message}>
            <Input {...register("reason")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Extend
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const quoteSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  quoteType: z.enum(["one_time_discount", "permanent_price_change", "manual"]),
  reason: z.string().optional(),
  adminNotes: z.string().optional(),
  effectiveDate: z.string().optional(),
  quoteExpiryDate: z.string().optional(),
  permanentNewAnnualPrice: z.string().optional(),
});

export function QuoteDialog({
  open,
  onOpenChange,
  websiteId,
  contract,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  contract: AmcContract | null;
  onSuccess?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof quoteSchema>>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { quoteType: "one_time_discount" },
  });

  const quoteType = watch("quoteType");

  useEffect(() => {
    if (open) {
      reset({
        amount: contract ? String((contract.negotiatedPricePaise ?? contract.renewalPricePaise) / 100) : "",
        quoteType: "one_time_discount",
        reason: "",
        adminNotes: "",
        effectiveDate: new Date().toISOString().slice(0, 10),
        quoteExpiryDate: "",
        permanentNewAnnualPrice: contract ? String(contract.renewalPricePaise / 100) : "",
      });
    }
  }, [open, contract, reset]);

  async function onSubmit(values: z.infer<typeof quoteSchema>) {
    const response = await fetch(`/api/admin/amc/${websiteId}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: values.amount,
        quoteType: values.quoteType,
        reason: values.reason || null,
        adminNotes: values.adminNotes || null,
        effectiveDate: values.effectiveDate || undefined,
        quoteExpiryDate: values.quoteExpiryDate || null,
        permanentNewAnnualPrice: values.permanentNewAnnualPrice || null,
      }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      toast.error(json?.error?.message ?? "Failed to update renewal quote");
      return;
    }
    toast.success("Renewal quote updated — no redeployment needed");
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change Renewal Price</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Quote Type" required>
            <Select {...register("quoteType")}>
              <option value="one_time_discount">One-time renewal discount</option>
              <option value="permanent_price_change">Permanent annual price change</option>
              <option value="manual">Manual quote</option>
            </Select>
          </Field>

          {quoteType === "permanent_price_change" ? (
            <Field label="New Permanent Annual Price (INR)" required error={errors.permanentNewAnnualPrice?.message}>
              <Input {...register("permanentNewAnnualPrice")} placeholder="2500" />
            </Field>
          ) : (
            <Field label="Renewal Amount (INR)" required error={errors.amount?.message}>
              <Input {...register("amount")} placeholder="2000" />
            </Field>
          )}

          <FieldRow>
            <Field label="Effective Date" error={errors.effectiveDate?.message}>
              <Input type="date" {...register("effectiveDate")} />
            </Field>
            <Field label="Quote Expiry Date" error={errors.quoteExpiryDate?.message}>
              <Input type="date" {...register("quoteExpiryDate")} />
            </Field>
          </FieldRow>

          <Field label="Reason" error={errors.reason?.message}>
            <Input {...register("reason")} placeholder="Negotiated with client" />
          </Field>
          <Field label="Admin Notes" error={errors.adminNotes?.message}>
            <Input {...register("adminNotes")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Quote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
