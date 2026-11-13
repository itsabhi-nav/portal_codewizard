import { getSupabase } from "@/lib/supabase/server";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { getAppSettings } from "@/lib/settings";
import { mapCronExecutionLog, mapNotificationTemplate } from "@/lib/mappers";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { SettingsForm } from "@/components/settings/settings-form";
import { TemplatesEditor } from "@/components/settings/templates-editor";
import { SystemHealth } from "@/components/settings/system-health";
import { formatDateTimeIST } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  if (!databaseReady()) {
    return <DatabaseNotice title="Settings" />;
  }

  const client = getSupabase();
  const settings = await getAppSettings(client);

  const [templatesRes, cronLogsRes] = await Promise.all([
    client.from("notification_templates").select("*").order("key", { ascending: true }),
    client.from("cron_execution_logs").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Settings" description="Configure agency, AMC, renewal screen, WhatsApp, payments and system health." />

      <SettingsForm initial={settings} />

      <TemplatesEditor initial={(templatesRes.data ?? []).map(mapNotificationTemplate)} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cron Execution History</CardTitle>
        </CardHeader>
        <CardContent>
          {(cronLogsRes.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No cron runs yet. Schedule the daily AMC check or run it manually.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Upcoming</TableHead>
                  <TableHead>Expired</TableHead>
                  <TableHead>Suspended</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cronLogsRes.data ?? []).map((log) => {
                  const mapped = mapCronExecutionLog(log);
                  return (
                    <TableRow key={mapped.id}>
                      <TableCell className="font-mono text-xs">{mapped.runId}</TableCell>
                      <TableCell className="text-sm">{formatDateTimeIST(mapped.startedAt)}</TableCell>
                      <TableCell className="text-sm">{mapped.trigger}</TableCell>
                      <TableCell>
                        <StatusBadge status={mapped.status} />
                      </TableCell>
                      <TableCell>{mapped.websitesProcessed}</TableCell>
                      <TableCell>{mapped.upcomingCount}</TableCell>
                      <TableCell>{mapped.expiredCount}</TableCell>
                      <TableCell>{mapped.newlySuspended}</TableCell>
                      <TableCell>{mapped.errors.length}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SystemHealth />
    </div>
  );
}
