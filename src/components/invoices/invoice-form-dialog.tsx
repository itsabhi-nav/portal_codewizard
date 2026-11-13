"use client";

import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/form-field";
import type { Client } from "@/lib/types";

const itemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1),
  unitPrice: z.string().min(1),
  taxRatePercent: z.string().optional(),
});

const schema = z.object({
  clientId: z.string().min(1, "Client is required"),
  websiteId: z.string().optional(),
  invoiceType: z.enum(["development", "amc", "additional_service", "hosting", "other"]),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().optional(),
  taxRatePercent: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one line item is required"),
});

export function InvoiceFormDialog({
  open,
  onOpenChange,
  clients,
  websites,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  websites: Array<{ id: string; clientId: string; name: string }>;
  onSuccess?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoiceType: "development",
      issueDate: new Date().toISOString().slice(0, 10),
      taxRatePercent: "0",
      items: [{ description: "", quantity: "1", unitPrice: "", taxRatePercent: "0" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const clientId = watch("clientId");
  const filteredWebsites = clientId ? websites.filter((w) => w.clientId === clientId) : websites;

  useEffect(() => {
    if (open) {
      reset({
        clientId: "",
        websiteId: "",
        invoiceType: "development",
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: "",
        taxRatePercent: "0",
        notes: "",
        items: [{ description: "", quantity: "1", unitPrice: "", taxRatePercent: "0" }],
      });
    }
  }, [open, reset]);

  async function onSubmit(values: z.infer<typeof schema>) {
    const payload = {
      clientId: values.clientId,
      websiteId: values.websiteId || null,
      invoiceType: values.invoiceType,
      issueDate: values.issueDate,
      dueDate: values.dueDate || null,
      taxRatePercent: Number(values.taxRatePercent ?? 0),
      notes: values.notes || null,
      items: values.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice,
        taxRatePercent: Number(item.taxRatePercent ?? 0),
      })),
    };
    const response = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      toast.error(json?.error?.message ?? "Failed to create invoice");
      return;
    }
    toast.success("Invoice created");
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
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
            <Field label="Invoice Type" required>
              <Select {...register("invoiceType")}>
                <option value="development">Development</option>
                <option value="amc">AMC</option>
                <option value="additional_service">Additional Service</option>
                <option value="hosting">Hosting</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Tax Rate (%)" error={errors.taxRatePercent?.message}>
              <Input type="number" {...register("taxRatePercent")} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Issue Date" required error={errors.issueDate?.message}>
              <Input type="date" {...register("issueDate")} />
            </Field>
            <Field label="Due Date" error={errors.dueDate?.message}>
              <Input type="date" {...register("dueDate")} />
            </Field>
          </FieldRow>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Line Items</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ description: "", quantity: "1", unitPrice: "", taxRatePercent: "0" })}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3">
                <div className="col-span-12 sm:col-span-5">
                  <Field label="Description" error={errors.items?.[index]?.description?.message}>
                    <Input {...register(`items.${index}.description`)} placeholder="Web design & development" />
                  </Field>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Field label="Qty" error={errors.items?.[index]?.quantity?.message}>
                    <Input type="number" {...register(`items.${index}.quantity`)} />
                  </Field>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Field label="Unit Price" error={errors.items?.[index]?.unitPrice?.message}>
                    <Input {...register(`items.${index}.unitPrice`)} placeholder="1000" />
                  </Field>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Field label="Tax %" error={errors.items?.[index]?.taxRatePercent?.message}>
                    <Input type="number" {...register(`items.${index}.taxRatePercent`)} />
                  </Field>
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register("notes")} rows={2} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
