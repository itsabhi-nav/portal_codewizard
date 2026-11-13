"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Copy, Check, Eye, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { interpolateTemplate } from "@/lib/whatsapp";
import type { NotificationTemplate } from "@/lib/types";

const SAMPLE_VARIABLES: Record<string, string> = {
  client_name: "Acme Pvt Ltd",
  contact_person: "Rahul Sharma",
  website_name: "Acme Corporate Site",
  domain: "acme.com",
  mobile: "+919876543210",
  amc_amount: "₹3,000.00",
  renewal_amount: "₹2,000.00",
  expiry_date: "31 Dec 2026",
  days_remaining: "7",
  days_overdue: "2",
  payment_link: "https://pay.codewizard.test/renew/xyz",
};

export function TemplatesEditor({ initial }: { initial: NotificationTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<NotificationTemplate[]>(initial);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  function update(key: string, patch: Partial<NotificationTemplate>) {
    setTemplates((prev) => prev.map((template) => (template.key === key ? { ...template, ...patch } : template)));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          templates.map(({ key, name, body, isActive }) => ({ key, name, body, isActive }))
        ),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        toast.error(json?.error?.message ?? "Failed to save templates");
        return;
      }
      toast.success("Templates saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function copyTemplate(template: NotificationTemplate) {
    await navigator.clipboard.writeText(interpolateTemplate(template.body, SAMPLE_VARIABLES));
    setCopiedKey(template.key);
    toast.success("Message copied with sample variables");
    setTimeout(() => setCopiedKey(null), 1500);
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <CardTitle className="text-base">WhatsApp Message Templates</CardTitle>
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Templates
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
          Available variables:{" "}
          {Object.keys(SAMPLE_VARIABLES).map((key) => (
            <code key={key} className="mr-2 rounded bg-background px-1 py-0.5 text-foreground">
              {`{${key}}`}
            </code>
          ))}
        </div>

        {templates.map((template) => {
          const open = openKey === template.key;
          const preview = interpolateTemplate(template.body, SAMPLE_VARIABLES);
          return (
            <div key={template.key} className="rounded-lg border">
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : template.key)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={open}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-180"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{template.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{template.key}</span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch
                      checked={template.isActive}
                      onCheckedChange={(checked) => update(template.key, { isActive: checked })}
                    />
                    Active
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyTemplate(template)}
                    title="Copy sample message"
                  >
                    {copiedKey === template.key ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {open ? (
                <div className="space-y-2 px-3 pb-3">
                  <Textarea
                    value={template.body}
                    onChange={(e) => update(template.key, { body: e.target.value })}
                    rows={4}
                  />
                  <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                    <p className="mb-1 flex items-center gap-1 font-medium">
                      <Eye className="h-3 w-3" /> Live preview
                    </p>
                    <p className="whitespace-pre-wrap">{preview}</p>
                  </div>
                </div>
              ) : (
                <p className="line-clamp-1 px-3 pb-3 pl-9 text-xs text-muted-foreground">{preview}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
