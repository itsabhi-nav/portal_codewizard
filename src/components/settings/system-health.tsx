"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeIST } from "@/lib/dates";

interface HealthResponse {
  status: string;
  timestamp: string;
  environment: string;
  checks: {
    environment: { ok: boolean; missing: string[] };
    database: { ok: boolean; latencyMs: number | null };
    supabase: { configured: boolean };
    razorpay: { configured: boolean; enabled: boolean };
    license: { configured: boolean };
  };
}

export function SystemHealth() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadHealth() {
    setLoading(true);
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const json = await response.json();
      if (json.success) setHealth(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  async function runCron() {
    setRunning(true);
    try {
      const response = await fetch("/api/admin/cron/run", { method: "POST" });
      const json = await response.json();
      if (json.success) {
        toast.success(
          `AMC check finished: ${json.data.websitesProcessed} websites, ${json.data.newlySuspended} newly suspended`
        );
        router.refresh();
      } else {
        toast.error(json?.error?.message ?? "Cron run failed");
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">System Health</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadHealth}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={runCron} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run AMC Check Now
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !health ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Checking system health…</p>
        ) : health ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              {health.status === "healthy" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <span className="font-medium">Overall status: {health.status}</span>
              <span className="text-xs text-muted-foreground">· {formatDateTimeIST(health.timestamp)}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <HealthItem label="Database" ok={health.checks.database.ok} detail={health.checks.database.latencyMs ? `${health.checks.database.latencyMs}ms` : "unreachable"} />
              <HealthItem label="Environment Config" ok={health.checks.environment.ok} detail={health.checks.environment.missing.length ? `Missing: ${health.checks.environment.missing.join(", ")}` : "complete"} />
              <HealthItem label="Razorpay" ok={health.checks.razorpay.configured} detail={health.checks.razorpay.enabled ? "configured + enabled" : "not enabled"} />
              <HealthItem label="License Signing" ok={health.checks.license.configured} detail={health.checks.license.configured ? "configured" : "missing"} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4" /> Unable to load health status
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HealthItem({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
        {label}
      </div>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
