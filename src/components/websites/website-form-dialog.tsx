"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Copy, Check, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldRow } from "@/components/form-field";
import type { Client, Website } from "@/lib/types";

const schema = z.object({
  clientId: z.string().min(1, "Client is required"),
  name: z.string().min(1, "Website name is required"),
  description: z.string().optional(),
  domain: z.string().optional(),
  goLiveDate: z.string().optional(),
  developmentCost: z.string().optional(),
  domainCharge: z.string().optional(),
  amcHosting: z.string().optional(),
  domainAlreadyOwned: z.boolean(),
  status: z.enum(["development", "testing", "live", "suspended", "archived"]),
  hostingProvider: z.string().optional(),
  notes: z.string().optional(),
});

const STATUS_HELP: Record<string, string> = {
  development: "Working on it — not public yet.",
  testing: "Built, being tested before launch.",
  live: "Public and active. AMC is required.",
  suspended: "Temporarily switched off (non-payment or manual).",
  archived: "Permanently closed. Kept for history — never deleted.",
};

type Values = z.infer<typeof schema>;

export function WebsiteFormDialog({
  open,
  onOpenChange,
  initial,
  clients,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Website | null;
  clients: Client[];
  onSuccess?: () => void;
}) {
  const [licenseSecret, setLicenseSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "development",
      domainAlreadyOwned: false,
    },
  });

  const status = watch("status") ?? "development";

  useEffect(() => {
    if (open) {
      setLicenseSecret(null);
      setCopied(false);
      reset({
        clientId: initial?.clientId ?? "",
        name: initial?.name ?? "",
        description: initial?.description ?? "",
        domain: initial?.domains?.find((d) => d.isPrimary)?.domain ?? "",
        goLiveDate: initial?.goLiveDate ?? "",
        developmentCost: initial ? String(initial.developmentCostPaise / 100) : "",
        domainCharge: initial ? String(initial.domainChargePaise / 100) : "",
        amcHosting: initial ? String(initial.hostingChargePaise / 100) : "",
        domainAlreadyOwned: false,
        status: initial?.status ?? "development",
        hostingProvider: initial?.hostingProvider ?? "",
        notes: initial?.notes ?? "",
      });
    }
  }, [open, initial, reset]);

  async function onSubmit(values: Values) {
    const payload = {
      clientId: values.clientId,
      name: values.name,
      description: values.description || null,
      domain: values.domain || null,
      goLiveDate: values.goLiveDate || null,
      developmentCost: values.developmentCost || "0",
      domainCharge: values.domainAlreadyOwned ? "0" : (values.domainCharge || "0"),
      hostingCharge: values.amcHosting || "0",
      amcAmount: values.amcHosting || undefined,
      status: values.status,
      hostingProvider: values.hostingProvider || null,
      notes: values.notes || null,
    };

    const response = await fetch(initial ? `/api/admin/websites/${initial.id}` : "/api/admin/websites", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      toast.error(json?.error?.message ?? "Failed to save website");
      return;
    }

    if (!initial && json.data.licenseSecret) {
      setLicenseSecret(json.data.licenseSecret);
    } else {
      toast.success(initial ? "Website updated" : "Website created");
      onOpenChange(false);
      onSuccess?.();
    }
  }

  async function copySecret() {
    if (!licenseSecret) return;
    await navigator.clipboard.writeText(licenseSecret);
    setCopied(true);
    toast.success("License secret copied. Store it securely — it will not be shown again.");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{initial ? "Edit Website" : "Add Website"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FieldRow>
              <Field label="Client" required error={errors.clientId?.message}>
                <Select value={undefined} disabled={Boolean(initial)} {...register("clientId")}>
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.clientCode})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Website Name" required error={errors.name?.message}>
                <Input {...register("name")} placeholder="Acme Corporate Site" />
              </Field>
            </FieldRow>

            <Field label="Description" error={errors.description?.message}>
              <Textarea {...register("description")} rows={2} placeholder="What is this website about?" />
            </Field>

            <FieldRow>
              <Field label="Domain" error={errors.domain?.message} hint="Optional — you can add it later">
                <Input {...register("domain")} placeholder="example.com" />
              </Field>
              <Field label="Hosting Provider" error={errors.hostingProvider?.message}>
                <Input {...register("hostingProvider")} placeholder="Netlify / Vercel / AWS" />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Status" error={errors.status?.message}>
                <Select {...register("status")}>
                  <option value="development">Development</option>
                  <option value="testing">Testing</option>
                  <option value="live">Live</option>
                  <option value="suspended">Suspended</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
              <Field label="Go-live Date" error={errors.goLiveDate?.message}>
                <Input type="date" {...register("goLiveDate")} />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Development Cost (₹)" error={errors.developmentCost?.message}>
                <Input {...register("developmentCost")} placeholder="75000" />
              </Field>
              <Field label="Domain Charge (₹) — Optional" hint="Only if you charge for domain registration/renewal">
                <Input
                  {...register("domainCharge")}
                  placeholder="800"
                  disabled={watch("domainAlreadyOwned")}
                  className={watch("domainAlreadyOwned") ? "opacity-40" : ""}
                />
              </Field>
            </FieldRow>
            <Field
              label="AMC & Hosting (₹/year)"
              hint="One annual charge — covers hosting & AMC. Auto-sets 365-day validity from go-live"
            >
              <Input {...register("amcHosting")} placeholder="5000" />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-muted-foreground">
              <Checkbox
                checked={watch("domainAlreadyOwned")}
                onCheckedChange={(checked) =>
                  reset({ ...watch(), domainAlreadyOwned: Boolean(checked), domainCharge: checked ? "" : watch("domainCharge") })
                }
              />
              Client&apos;s domain is already registered — don&apos;t charge for it
            </label>
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{status.charAt(0).toUpperCase() + status.slice(1)} — </span>
              {STATUS_HELP[status]}
            </p>

            <Field label="Internal Notes" error={errors.notes?.message}>
              <Textarea {...register("notes")} rows={2} />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initial ? "Save Changes" : "Create Website"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(licenseSecret)} onOpenChange={(next) => {
        if (!next) {
          setLicenseSecret(null);
          onOpenChange(false);
          onSuccess?.();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> License Credential Created
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy this server-side integration secret now. It is stored only as a hash and will not be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all text-xs">{licenseSecret}</code>
              <Button variant="outline" size="icon" onClick={copySecret}>
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={() => {
              setLicenseSecret(null);
              onOpenChange(false);
              onSuccess?.();
            }}>
              I have saved the secret
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
