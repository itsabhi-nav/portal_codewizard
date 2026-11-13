"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Copy, Check, KeyRound, ArrowRight, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldRow } from "@/components/form-field";
import type { Client, Website } from "@/lib/types";

const schema = z.object({
  useExisting: z.boolean(),
  existingClientId: z.string().optional(),
  clientName: z.string().optional(),
  businessName: z.string().optional(),
  contactPerson: z.string().optional(),
  mobile: z.string().optional(),
  whatsappNumber: z.string().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  websiteName: z.string().min(1, "Website name is required"),
  domain: z.string().optional(),
  description: z.string().optional(),
  goLiveDate: z.string().optional(),
  developmentCost: z.string().optional(),
  domainCharge: z.string().optional(),
  amcHosting: z.string().optional(),
  domainAlreadyOwned: z.boolean(),
  hostingProvider: z.string().optional(),
  status: z.enum(["development", "testing", "live", "suspended", "archived"]),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

const STATUS_HELP: Record<Values["status"], string> = {
  development: "Working on it — not public yet.",
  testing: "Built, being tested before launch.",
  live: "Public and active. AMC is required.",
  suspended: "Temporarily switched off (non-payment or manual).",
  archived: "Permanently closed. Kept for history — never deleted.",
};

export function UnifiedEntryDialog({
  open,
  onOpenChange,
  clients,
  onSuccess,
  editingClient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onSuccess?: () => void;
  /** When set, the dialog edits this client (and one of their websites) instead of creating a new entry. */
  editingClient?: Client | null;
}) {
  const [licenseSecret, setLicenseSecret] = useState<string | null>(null);
  const [createdWebsiteId, setCreatedWebsiteId] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<"form" | "secret">("form");
  const [editWebsites, setEditWebsites] = useState<Website[]>([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("");
  const [loadingEdit, setLoadingEdit] = useState(false);
  const isEdit = Boolean(editingClient);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      useExisting: false,
      status: "development",
      domainAlreadyOwned: false,
    },
  });

  const useExisting = watch("useExisting");
  const status = watch("status");

  function handleWebsiteSelection(websiteId: string) {
    setSelectedWebsiteId(websiteId);
    if (!editingClient) return;
    const website = editWebsites.find((w) => w.id === websiteId) ?? null;
    prefillWebsite(reset, editingClient, website);
  }

  function prefillWebsite(
    resetFn: (values: Values) => void,
    client: Client,
    website: Website | null
  ) {
    const primaryDomain =
      website?.domains?.find((d) => d.isPrimary)?.domain ?? website?.domains?.[0]?.domain ?? "";
    resetFn({
      useExisting: false,
      existingClientId: "",
      clientName: client.name ?? "",
      businessName: client.businessName ?? "",
      contactPerson: client.contactPerson ?? "",
      mobile: client.mobile ?? "",
      whatsappNumber: client.whatsappNumber ?? "",
      email: client.email ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      state: client.state ?? "",
      pinCode: client.pinCode ?? "",
      websiteName: website?.name ?? "",
      domain: primaryDomain,
      description: website?.description ?? "",
      goLiveDate: website?.goLiveDate ?? "",
      developmentCost: website ? String(website.developmentCostPaise / 100) : "",
      domainCharge: website ? String(website.domainChargePaise / 100) : "",
      amcHosting: website ? String(website.hostingChargePaise / 100) : "",
      domainAlreadyOwned: false,
      hostingProvider: website?.hostingProvider ?? "",
      status: website?.status ?? "development",
      notes: website?.notes ?? client.notes ?? "",
    });
  }

  const loadEditableWebsites = useCallback(async function loadEditableWebsites(client: Client) {
    setLoadingEdit(true);
    try {
      const response = await fetch(`/api/admin/websites?clientId=${client.id}&pageSize=50`);
      const json = await response.json();
      const items: Website[] = json?.data?.items ?? [];
      setEditWebsites(items);
      const first = items[0] ?? null;
      setSelectedWebsiteId(first?.id ?? "");
      prefillWebsite(reset, client, first);
    } catch {
      toast.error("Failed to load the client's websites");
    } finally {
      setLoadingEdit(false);
    }
  }, [reset]);

  useEffect(() => {
    if (open) {
      setLicenseSecret(null);
      setCreatedWebsiteId(null);
      setCopied(false);
      setStep("form");
      if (editingClient) {
        setEditWebsites([]);
        setSelectedWebsiteId("");
        void loadEditableWebsites(editingClient);
        return;
      }
      reset({
        useExisting: false,
        existingClientId: "",
        clientName: "",
        businessName: "",
        contactPerson: "",
        mobile: "",
        whatsappNumber: "",
        email: "",
        address: "",
        city: "",
        state: "",
        pinCode: "",
        websiteName: "",
        domain: "",
        description: "",
        goLiveDate: "",
        developmentCost: "",
        domainCharge: "",
        amcHosting: "",
        domainAlreadyOwned: false,
        hostingProvider: "",
        status: "development",
        notes: "",
      });
    }
  }, [open, reset, editingClient, loadEditableWebsites]);

  async function onSubmit(values: Values) {
    if (editingClient) {
      // Edit mode: update the client, then the selected website, then the domain.
      const clientResponse = await fetch(`/api/admin/clients/${editingClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.clientName || editingClient.name,
          businessName: values.businessName || null,
          contactPerson: values.contactPerson || null,
          mobile: values.mobile || null,
          whatsappNumber: values.whatsappNumber || null,
          email: values.email || null,
          address: values.address || null,
          city: values.city || null,
          state: values.state || null,
          pinCode: values.pinCode || null,
          notes: values.notes || null,
        }),
      });
      const clientJson = await clientResponse.json();
      if (!clientResponse.ok || !clientJson.success) {
        toast.error(clientJson?.error?.message ?? "Failed to update client");
        return;
      }

      const websiteId = selectedWebsiteId || editWebsites[0]?.id;
      if (websiteId) {
        const websiteResponse = await fetch(`/api/admin/websites/${websiteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.websiteName || "Untitled",
            description: values.description || null,
            goLiveDate: values.goLiveDate || null,
            developmentCost: values.developmentCost || "0",
            domainCharge: values.domainAlreadyOwned ? "0" : (values.domainCharge || "0"),
            hostingCharge: values.amcHosting || "0",
            amcAmount: values.amcHosting || undefined,
            status: values.status,
            hostingProvider: values.hostingProvider || null,
            notes: values.notes || null,
          }),
        });
        const websiteJson = await websiteResponse.json();
        if (!websiteResponse.ok || !websiteJson.success) {
          toast.error(websiteJson?.error?.message ?? "Client updated, but website update failed");
          return;
        }

        // Domain change goes through the domain endpoint (records history).
        const current = editWebsites.find((w) => w.id === websiteId);
        const currentDomain =
          current?.domains?.find((d) => d.isPrimary)?.domain ?? current?.domains?.[0]?.domain ?? "";
        const newDomain = (values.domain ?? "").trim().toLowerCase();
        if (newDomain && newDomain !== currentDomain) {
          const domainResponse = await fetch(`/api/admin/websites/${websiteId}/domain`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain: newDomain, isPrimary: true, reason: "Edited from entry dialog" }),
          });
          const domainJson = await domainResponse.json();
          if (!domainResponse.ok || !domainJson.success) {
            toast.error(domainJson?.error?.message ?? "Website saved, but domain update failed");
            return;
          }
        }
      }

      toast.success("Entry updated — invoice, charges and AMC stay in sync");
      onOpenChange(false);
      onSuccess?.();
      return;
    }

    // 1. Resolve the client (existing or new)
    let clientId = values.existingClientId;

    if (!values.useExisting) {
      if (!values.clientName?.trim()) {
        toast.error("Client name is required");
        return;
      }
      const clientResponse = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.clientName,
          businessName: values.businessName || null,
          contactPerson: values.contactPerson || null,
          mobile: values.mobile || null,
          whatsappNumber: values.whatsappNumber || null,
          email: values.email || null,
          address: values.address || null,
          city: values.city || null,
          state: values.state || null,
          pinCode: values.pinCode || null,
          notes: values.notes || null,
        }),
      });
      const clientJson = await clientResponse.json();
      if (!clientResponse.ok || !clientJson.success) {
        toast.error(clientJson?.error?.message ?? "Failed to create client");
        return;
      }
      clientId = clientJson.data.id;
    }

    if (!clientId) {
      toast.error("Please select or enter a client");
      return;
    }

    // 2. Create the website (auto-generates invoice + AMC when applicable)
    const websiteResponse = await fetch("/api/admin/websites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        name: values.websiteName,
        domain: values.domain || null,
        description: values.description || null,
        goLiveDate: values.goLiveDate || null,
        developmentCost: values.developmentCost || "0",
        domainCharge: values.domainAlreadyOwned ? "0" : (values.domainCharge || "0"),
        hostingCharge: values.amcHosting || "0",
        hostingProvider: values.hostingProvider || null,
        amcAmount: values.amcHosting || undefined,
        status: values.status,
        notes: values.notes || null,
      }),
    });
    const websiteJson = await websiteResponse.json();
    if (!websiteResponse.ok || !websiteJson.success) {
      toast.error(websiteJson?.error?.message ?? "Failed to create website");
      return;
    }

    toast.success("Entry created successfully");
    if (websiteJson.data.licenseSecret) {
      setLicenseSecret(websiteJson.data.licenseSecret);
      setCreatedWebsiteId(websiteJson.data.website?.id ?? null);
      setStep("secret");
    } else {
      onOpenChange(false);
      onSuccess?.();
    }
  }

  async function regenerateSecret() {
    if (!createdWebsiteId) return;
    setRotating(true);
    try {
      const response = await fetch(`/api/admin/websites/${createdWebsiteId}/license`, { method: "POST" });
      const json = await response.json();
      if (json.success) {
        setLicenseSecret(json.data.secret);
        setCopied(false);
        toast.success("New secret generated — the old one no longer works");
      } else {
        toast.error(json?.error?.message ?? "Failed to regenerate secret");
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setRotating(false);
    }
  }

  async function copySecret() {
    if (!licenseSecret) return;
    await navigator.clipboard.writeText(licenseSecret);
    setCopied(true);
    toast.success("License secret copied. Store it securely.");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              {isEdit ? "Edit Entry" : "Add Client & Website"}
            </DialogTitle>
          </DialogHeader>

          {step === "form" && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* ---- Client section ---- */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    1. Client
                  </h3>
                  {!isEdit && (
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={useExisting}
                        onCheckedChange={(checked) => reset({ ...watch(), useExisting: Boolean(checked) })}
                      />
                      Existing client
                    </label>
                  )}
                </div>

                {isEdit ? null : useExisting ? (
                  <Field label="Select Client" required>
                    <Select {...register("existingClientId")}>
                      <option value="">Select client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.clientCode})
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <>
                    <FieldRow>
                      <Field label="Client Name" required>
                        <Input {...register("clientName")} placeholder="Acme Pvt Ltd" />
                      </Field>
                      <Field label="Business / Organization">
                        <Input {...register("businessName")} placeholder="Acme Retail" />
                      </Field>
                    </FieldRow>
                    <FieldRow>
                      <Field label="Contact Person">
                        <Input {...register("contactPerson")} placeholder="Rahul Sharma" />
                      </Field>
                      <Field label="Mobile Number">
                        <Input {...register("mobile")} placeholder="+919876543210" />
                      </Field>
                    </FieldRow>
                    <FieldRow>
                      <Field label="WhatsApp Number">
                        <Input {...register("whatsappNumber")} placeholder="+919876543210" />
                      </Field>
                      <Field label="Email" error={errors.email?.message}>
                        <Input {...register("email")} placeholder="client@example.com" />
                      </Field>
                    </FieldRow>
                    <Field label="Address">
                      <Input {...register("address")} placeholder="Street, City, State, PIN" />
                    </Field>
                  </>
                )}
              </div>

              <Separator />

              {/* ---- Website section ---- */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  2. Website
                </h3>
                {isEdit && loadingEdit && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading websites…
                  </p>
                )}
                {isEdit && !loadingEdit && editWebsites.length > 1 && (
                  <Field label="Which website?">
                    <Select
                      value={selectedWebsiteId}
                      onChange={(event) => handleWebsiteSelection(event.target.value)}
                    >
                      {editWebsites.map((website) => (
                        <option key={website.id} value={website.id}>
                          {website.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {isEdit && !loadingEdit && editWebsites.length === 0 && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    This client has no websites yet — add one with the Add Entry button.
                  </p>
                )}
                <FieldRow>
                  <Field label="Website Name" required error={errors.websiteName?.message}>
                    <Input {...register("websiteName")} placeholder="Acme Corporate Site" />
                  </Field>
                  <Field label="Domain" hint="Optional — can be added later">
                    <Input {...register("domain")} placeholder="acme.com" />
                  </Field>
                </FieldRow>
                <Field label="Description">
                  <Textarea {...register("description")} rows={2} placeholder="What is this site about?" />
                </Field>
                <FieldRow>
                  <Field label="Hosting Provider">
                    <Input {...register("hostingProvider")} placeholder="Netlify / Vercel / AWS" />
                  </Field>
                  <Field label="Go-live Date">
                    <Input type="date" {...register("goLiveDate")} />
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field label="Status">
                    <Select {...register("status")}>
                      <option value="development">Development</option>
                      <option value="testing">Testing</option>
                      <option value="live">Live</option>
                      <option value="suspended">Suspended</option>
                      <option value="archived">Archived</option>
                    </Select>
                  </Field>
                </FieldRow>
                <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">What does status mean? </span>
                  {STATUS_HELP[status]}
                </p>
              </div>

              <Separator />

              {/* ---- Charges section ---- */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  3. Charges
                </h3>
                <FieldRow>
                  <Field label="Development Cost (₹)">
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
                <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Leave any field blank if it doesn&apos;t apply (e.g. hosting not needed). An invoice is generated automatically when you save.
                </p>
              </div>

              <Separator />

              <Field label="Internal Notes">
                <Input {...register("notes")} placeholder="Any internal notes" />
              </Field>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  Create Entry
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* License secret reveal step */}
      <Dialog
        open={step === "secret" && Boolean(licenseSecret)}
        onOpenChange={(next) => {
          if (!next) {
            setStep("form");
            setLicenseSecret(null);
            setCreatedWebsiteId(null);
            onOpenChange(false);
            onSuccess?.();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              License Secret (copy now)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy this server-side secret now. It is stored only as a hash and will not be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all text-xs">{licenseSecret}</code>
              <Button variant="outline" size="icon" onClick={copySecret}>
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={regenerateSecret}
              disabled={rotating}
            >
              {rotating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Lost it? Regenerate secret
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Regenerating invalidates the old secret immediately.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setStep("form");
                setLicenseSecret(null);
                setCreatedWebsiteId(null);
                onOpenChange(false);
                onSuccess?.();
              }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
