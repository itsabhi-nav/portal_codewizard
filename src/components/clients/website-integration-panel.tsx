"use client";

import { useState } from "react";
import { Copy, Check, KeyRound, Loader2, ShieldCheck, Globe } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface IntegrationRow {
  websiteId: string;
  websiteName: string;
  publicId: string;
  secretPrefix: string | null;
  isActive: boolean;
}

/**
 * Everything needed to wire a client website to the license engine — shown
 * inline on the client page. Regenerating reveals the full secret exactly
 * once; the built .env snippet is copied in one click.
 */
export function WebsiteIntegrationPanel({ rows, apiUrl }: { rows: IntegrationRow[]; apiUrl: string }) {
  const [freshSecrets, setFreshSecrets] = useState<Record<string, string>>({});
  const [rotating, setRotating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const origin = apiUrl;

  async function copy(value: string, tag: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(tag);
      toast.success("Copied");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  async function regenerate(websiteId: string, websiteName: string) {
    setRotating(websiteId);
    try {
      const response = await fetch(`/api/admin/websites/${websiteId}/license`, { method: "POST" });
      const json = await response.json();
      if (json.success) {
        setFreshSecrets((prev) => ({ ...prev, [websiteId]: json.data.secret as string }));
        toast.success(`New secret for "${websiteName}" — copy it now, it will not be shown again`);
      } else {
        toast.error(json?.error?.message ?? "Failed to regenerate secret");
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setRotating(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Website Integration
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Paste these into the client website&apos;s environment — the license engine takes over from there.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => {
          const freshSecret = freshSecrets[row.websiteId];
          const envSnippet = [
            `CODEWIZARD_API_URL=${origin}`,
            `CODEWIZARD_WEBSITE_ID=${row.publicId}`,
            `CODEWIZARD_WEBSITE_SECRET=${freshSecret ?? "••••••••••••••••"}`,
            `CODEWIZARD_CACHE_TTL=0`,
            `CODEWIZARD_EDGE_CACHE_SECONDS=0`,
            `CODEWIZARD_OFFLINE_GRACE_SECONDS=86400`,
            `CODEWIZARD_FAIL_CLOSED=true`,
          ].join("\n");

          return (
            <div key={row.websiteId} className="space-y-3 rounded-lg border border-border/60 p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{row.websiteName}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                      row.isActive
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {row.isActive ? "● License active" : "● Not active"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => regenerate(row.websiteId, row.websiteName)}
                    disabled={rotating === row.websiteId}
                  >
                    {rotating === row.websiteId ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <KeyRound className="mr-1 h-3 w-3" />
                    )}
                    Regenerate secret
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase text-muted-foreground">Website ID</span>
                    <code className="block truncate font-mono text-[11px]">{row.websiteId}</code>
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copy(row.websiteId, `wid-${row.websiteId}`)}>
                    {copied === `wid-${row.websiteId}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase text-muted-foreground">Public ID</span>
                    <code className="block truncate font-mono text-[11px]">{row.publicId}</code>
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copy(row.publicId, `pid-${row.websiteId}`)}>
                    {copied === `pid-${row.websiteId}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {freshSecret && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
                  <p className="font-semibold">New secret — copy it now:</p>
                  <code className="mt-1 block break-all text-[11px]">{freshSecret}</code>
                </div>
              )}

              <div className="relative rounded-md bg-muted/40 p-3">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-foreground">{envSnippet}</pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={() => copy(envSnippet, `env-${row.websiteId}`)}
                  title="Copy .env snippet"
                >
                  {copied === `env-${row.websiteId}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {freshSecret
                  ? "This snippet contains the live secret — paste it now; after this page is refreshed the secret is gone forever."
                  : "The secret line is masked until you Regenerate — the real secret is shown only once at generation time."}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
