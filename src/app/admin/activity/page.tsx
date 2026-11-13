import Link from "next/link";
import { Activity as ActivityIcon, Filter } from "lucide-react";
import { getSupabase } from "@/lib/supabase/server";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatDateTimeIST } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity Logs" };

const EVENT_TYPES = [
  "client.created",
  "client.updated",
  "client.archived",
  "website.created",
  "website.updated",
  "domain.changed",
  "project.created",
  "project.updated",
  "invoice.created",
  "payment.received",
  "payment.failed",
  "refund.processed",
  "amc.configured",
  "amc.price_changed",
  "amc.negotiated_price_applied",
  "amc.renewed",
  "website.expired",
  "website.suspended",
  "website.reactivated",
  "license.exemption_applied",
  "cron.executed",
  "webhook.received",
];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ eventType?: string; search?: string; websiteId?: string }>;
}) {
  const { eventType, search, websiteId } = await searchParams;
  if (!databaseReady()) {
    return <DatabaseNotice title="Activity Logs" />;
  }

  const client = getSupabase();

  let query = client
    .from("activity_logs")
    .select("*, client:clients(id, name), website:websites(id, name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (eventType) query = query.eq("event_type", eventType);
  if (websiteId) query = query.eq("website_id", websiteId);
  if (search) query = query.ilike("description", `%${search.replace(/[%_]/g, "")}%`);

  const { data: logs } = await query;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Activity Logs" description="Immutable audit trail of important business and security events." />

      <Card>
        <form method="GET" className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium">Search</label>
            <Input name="search" defaultValue={search ?? ""} placeholder="Search description…" />
          </div>
          <div className="sm:w-64">
            <label className="mb-1.5 block text-sm font-medium">Event Type</label>
            <Select name="eventType" defaultValue={eventType ?? ""}>
              <option value="">All events</option>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <input type="hidden" name="websiteId" value={websiteId ?? ""} />
          <Button type="submit">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
        </form>

        <CardContent>
          {(logs ?? []).length === 0 ? (
            <EmptyState
              title="No activity"
              description="Activity will appear here as you manage clients, websites and payments."
              icon={<ActivityIcon className="h-6 w-6" />}
            />
          ) : (
            <div className="space-y-3">
              {(logs ?? []).map((log) => (
                <div key={log.id} className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-0">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{log.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{log.event_type}</span>
                      <span>{log.actor}</span>
                      {log.client && (
                        <Link href={`/admin/clients/${log.client.id}`} className="text-primary hover:underline">
                          {log.client.name}
                        </Link>
                      )}
                      {log.website && (
                        <Link href={`/admin/websites/${log.website.id}`} className="text-primary hover:underline">
                          {log.website.name}
                        </Link>
                      )}
                      <span>{formatDateTimeIST(log.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
