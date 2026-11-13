import Link from "next/link";
import { Users, Globe, IndianRupee, Clock, RefreshCw, Ban, TrendingUp, Wallet } from "lucide-react";
import { getSupabase } from "@/lib/supabase/server";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { getDashboardMetrics } from "@/lib/dashboard-service";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { RevenueAreaChart, RevenueSplitChart, WebsiteStatusChart } from "@/components/charts/dashboard-charts";
import { formatINR, formatAmount } from "@/lib/money";
import { formatDateIST, relativeDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  if (!databaseReady()) {
    return <DatabaseNotice title="Dashboard" />;
  }

  const client = getSupabase();
  const metrics = await getDashboardMetrics(client);

  const { totals, charts } = metrics;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Dashboard"
        description="Business overview, revenue and AMC health at a glance."
        actions={
          <Link href="/admin/clients?new=1">
            <span className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Add Entry
            </span>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Total Clients" value={String(totals.clients)} icon={<Users className="h-5 w-5" />} accent="blue" />
        <StatCard title="Total Websites" value={String(totals.websites)} subtitle={`${totals.activeWebsites} live`} icon={<Globe className="h-5 w-5" />} accent="cyan" />
        <StatCard title="Suspended" value={String(totals.suspendedWebsites)} subtitle="Require attention" icon={<Ban className="h-5 w-5" />} accent="rose" />
        <StatCard title="Upcoming Renewals" value={String(totals.upcomingRenewals)} subtitle="Within threshold" icon={<Clock className="h-5 w-5" />} accent="amber" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Revenue Collected"
          value={formatINR(totals.totalRevenuePaise)}
          subtitle={`Dev ${formatAmount(totals.totalDevelopmentRevenuePaise)} · AMC ${formatAmount(totals.totalAmcRevenuePaise)}`}
          icon={<IndianRupee className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          title="Outstanding"
          value={formatINR(totals.outstandingPaise)}
          subtitle="Unpaid invoices"
          icon={<Wallet className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          title="Upcoming AMC Revenue"
          value={formatINR(totals.upcomingAmcRevenuePaise)}
          subtitle="Next 90 days"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          title="Refunds"
          value={formatINR(totals.totalRefundsPaise)}
          icon={<RefreshCw className="h-5 w-5" />}
          accent="rose"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueAreaChart data={charts.monthlyRevenue} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Split</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueSplitChart data={charts.revenueSplit} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Website Status</CardTitle>
          </CardHeader>
          <CardContent>
            <WebsiteStatusChart data={charts.websiteStatusDistribution} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Upcoming Renewals</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.upcomingRenewals.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No upcoming renewals.</p>
            ) : (
              <>
                <div className="divide-y md:hidden">
                  {metrics.upcomingRenewals.map((renewal) => (
                    <div key={renewal.websiteId} className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link href={`/admin/websites/${renewal.websiteId}`} className="block truncate text-sm font-medium hover:text-primary">
                          {renewal.websiteName}
                        </Link>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {renewal.clientName} · {formatDateIST(renewal.expiryDate)} ({relativeDays(renewal.daysRemaining)})
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{formatINR(renewal.amountPaise)}</p>
                        <StatusBadge status={renewal.daysRemaining <= 0 ? "expired" : renewal.daysRemaining <= 10 ? "upcoming" : "active"} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Website</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.upcomingRenewals.map((renewal) => (
                        <TableRow key={renewal.websiteId}>
                          <TableCell className="font-medium">
                            <Link href={`/admin/websites/${renewal.websiteId}`} className="hover:text-primary">
                              {renewal.websiteName}
                            </Link>
                          </TableCell>
                          <TableCell>{renewal.clientName}</TableCell>
                          <TableCell>
                            <div className="text-sm">{formatDateIST(renewal.expiryDate)}</div>
                            <div className="text-xs text-muted-foreground">{relativeDays(renewal.daysRemaining)}</div>
                          </TableCell>
                          <TableCell>{formatINR(renewal.amountPaise)}</TableCell>
                          <TableCell>
                            <StatusBadge status={renewal.daysRemaining <= 0 ? "expired" : renewal.daysRemaining <= 10 ? "upcoming" : "active"} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.recentActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-0">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{activity.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {activity.actor} · {formatDateIST(activity.createdAt)}
                    </p>
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
