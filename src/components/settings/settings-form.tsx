"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldRow } from "@/components/form-field";
import type { AppSettings } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(initial);

  function update<K extends keyof AppSettings>(section: K, patch: Partial<AppSettings[K]>) {
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...settings,
        amc: {
          ...settings.amc,
          defaultAmountPaise: Math.round(Number(settings.amc.defaultAmountPaise)),
        },
      };
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        toast.error(json?.error?.message ?? "Failed to save settings");
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Tabs defaultValue="general">
      <TabsList className="-mx-3 flex w-[calc(100%+1.5rem)] justify-start overflow-x-auto rounded-none px-3 sm:mx-0 sm:w-full sm:justify-center sm:rounded-lg sm:px-1">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="amc">AMC</TabsTrigger>
        <TabsTrigger value="renewal">Renewal Screen</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow>
              <Field label="Agency Name">
                <Input value={settings.general.agencyName} onChange={(e) => update("general", { agencyName: e.target.value })} />
              </Field>
              <Field label="Logo URL">
                <Input value={settings.general.logoUrl} onChange={(e) => update("general", { logoUrl: e.target.value })} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Support Email">
                <Input value={settings.general.supportEmail} onChange={(e) => update("general", { supportEmail: e.target.value })} />
              </Field>
              <Field label="Support Phone">
                <Input value={settings.general.supportPhone} onChange={(e) => update("general", { supportPhone: e.target.value })} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Website URL">
                <Input value={settings.general.websiteUrl} onChange={(e) => update("general", { websiteUrl: e.target.value })} />
              </Field>
              <Field label="Invoice Prefix">
                <Input value={settings.general.invoicePrefix} onChange={(e) => update("general", { invoicePrefix: e.target.value })} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Currency">
                <Input value={settings.general.currency} onChange={(e) => update("general", { currency: e.target.value })} />
              </Field>
              <Field label="Time Zone">
                <Input value={settings.general.timezone} onChange={(e) => update("general", { timezone: e.target.value })} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Default Theme">
                <Select value={settings.general.defaultTheme} onChange={(e) => update("general", { defaultTheme: e.target.value as "light" | "dark" | "system" })}>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </Field>
            </FieldRow>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="amc">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AMC Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow>
              <Field label="Default AMC Amount (INR)">
                <Input
                  type="number"
                  value={String(settings.amc.defaultAmountPaise / 100)}
                  onChange={(e) => update("amc", { defaultAmountPaise: Math.round(Number(e.target.value || 0) * 100) })}
                />
              </Field>
              <Field label="Default Billing Period (days)">
                <Input
                  type="number"
                  value={String(settings.amc.defaultBillingPeriodDays)}
                  onChange={(e) => update("amc", { defaultBillingPeriodDays: Number(e.target.value || 365) })}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Upcoming Threshold (days)">
                <Input
                  type="number"
                  value={String(settings.amc.upcomingThresholdDays)}
                  onChange={(e) => update("amc", { upcomingThresholdDays: Number(e.target.value || 10) })}
                />
              </Field>
              <Field label="Grace Period (days)">
                <Input
                  type="number"
                  value={String(settings.amc.gracePeriodDays)}
                  onChange={(e) => update("amc", { gracePeriodDays: Number(e.target.value || 3) })}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Reminder Intervals (comma separated)">
                <Input
                  value={settings.amc.reminderIntervals.join(", ")}
                  onChange={(e) =>
                    update("amc", {
                      reminderIntervals: e.target.value.split(",").map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v)),
                    })
                  }
                />
              </Field>
            </FieldRow>
            <div className="flex flex-wrap gap-8">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={settings.amc.autoSuspend}
                  onCheckedChange={(checked) => update("amc", { autoSuspend: checked })}
                />
                Auto-suspend after grace period
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={settings.amc.autoRemind}
                  onCheckedChange={(checked) => update("amc", { autoRemind: checked })}
                />
                Enable renewal reminders
              </label>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="renewal">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Renewal Screen Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow>
              <Field label="Heading">
                <Input value={settings.renewalScreen.heading} onChange={(e) => update("renewalScreen", { heading: e.target.value })} />
              </Field>
              <Field label="Button Text">
                <Input value={settings.renewalScreen.buttonText} onChange={(e) => update("renewalScreen", { buttonText: e.target.value })} />
              </Field>
            </FieldRow>
            <Field label="Description">
              <Textarea value={settings.renewalScreen.description} onChange={(e) => update("renewalScreen", { description: e.target.value })} rows={3} />
            </Field>
            <Field label="Support Text">
              <Textarea value={settings.renewalScreen.supportText} onChange={(e) => update("renewalScreen", { supportText: e.target.value })} rows={2} />
            </Field>
            <FieldRow>
              <Field label="Support Email">
                <Input value={settings.renewalScreen.supportEmail} onChange={(e) => update("renewalScreen", { supportEmail: e.target.value })} />
              </Field>
              <Field label="Support Phone">
                <Input value={settings.renewalScreen.supportPhone} onChange={(e) => update("renewalScreen", { supportPhone: e.target.value })} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Background Color">
                <Input value={settings.renewalScreen.background} onChange={(e) => update("renewalScreen", { background: e.target.value })} />
              </Field>
              <Field label="Text Color">
                <Input value={settings.renewalScreen.textColor} onChange={(e) => update("renewalScreen", { textColor: e.target.value })} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Button Color">
                <Input value={settings.renewalScreen.buttonColor} onChange={(e) => update("renewalScreen", { buttonColor: e.target.value })} />
              </Field>
              <Field label="Logo URL">
                <Input value={settings.renewalScreen.logoUrl} onChange={(e) => update("renewalScreen", { logoUrl: e.target.value })} />
              </Field>
            </FieldRow>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={settings.renewalScreen.showSupport}
                onCheckedChange={(checked) => update("renewalScreen", { showSupport: checked })}
              />
              Show support contact on renewal screen
            </label>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="whatsapp">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">WhatsApp Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow>
              <Field label="Default Country Code">
                <Input value={settings.whatsapp.defaultCountryCode} onChange={(e) => update("whatsapp", { defaultCountryCode: e.target.value })} />
              </Field>
              <Field label="Reminder Intervals (comma separated)">
                <Input
                  value={settings.whatsapp.reminderIntervals.join(", ")}
                  onChange={(e) =>
                    update("whatsapp", {
                      reminderIntervals: e.target.value.split(",").map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v)),
                    })
                  }
                />
              </Field>
            </FieldRow>
            <Field label="Default Client Message">
              <Textarea value={settings.whatsapp.defaultMessage} onChange={(e) => update("whatsapp", { defaultMessage: e.target.value })} rows={3} />
            </Field>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="payments">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment & Invoice Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={settings.payments.razorpayEnabled}
                onCheckedChange={(checked) => update("payments", { razorpayEnabled: checked })}
              />
              Enable Razorpay online payments
            </label>
            <FieldRow>
              <Field label="Enabled Payment Methods (comma separated)">
                <Input
                  value={settings.payments.methods.join(", ")}
                  onChange={(e) => update("payments", { methods: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
                />
              </Field>
              <Field label="Default Tax Rate (%)">
                <Input
                  type="number"
                  value={String(settings.payments.taxRatePercent)}
                  onChange={(e) => update("payments", { taxRatePercent: Number(e.target.value || 0) })}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Tax Label">
                <Input value={settings.payments.taxLabel} onChange={(e) => update("payments", { taxLabel: e.target.value })} placeholder="GST" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={settings.payments.taxEnabled}
                  onCheckedChange={(checked) => update("payments", { taxEnabled: checked })}
                />
                Enable tax on invoices
              </label>
            </FieldRow>
            <Field label="Invoice Notes">
              <Textarea value={settings.payments.invoiceNotes} onChange={(e) => update("payments", { invoiceNotes: e.target.value })} rows={2} />
            </Field>
          </CardContent>
        </Card>
      </TabsContent>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </Tabs>
  );
}
