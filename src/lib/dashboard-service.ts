import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIST } from "@/lib/dates";

export interface DashboardFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface MonthlyRevenue {
  month: string;
  total: number;
  development: number;
  amc: number;
  other: number;
}

export interface DashboardMetrics {
  totals: {
    clients: number;
    websites: number;
    activeWebsites: number;
    suspendedWebsites: number;
    archivedWebsites: number;
    upcomingRenewals: number;
    expiredWebsites: number;
    totalDevelopmentRevenuePaise: number;
    totalAmcRevenuePaise: number;
    totalRevenuePaise: number;
    totalRefundsPaise: number;
    outstandingPaise: number;
    upcomingAmcRevenuePaise: number;
  };
  amc: {
    enabled: number;
    active: number;
    upcoming: number;
    expired: number;
    overdue: number;
    suspended: number;
    exempt: number;
    disabled: number;
    amcPendingAmountPaise: number;
  };
  charts: {
    monthlyRevenue: MonthlyRevenue[];
    websiteStatusDistribution: { status: string; count: number }[];
    revenueSplit: { development: number; amc: number; other: number };
  };
  upcomingRenewals: {
    websiteId: string;
    websiteName: string;
    clientId: string;
    clientName: string;
    domain: string | null;
    expiryDate: string;
    daysRemaining: number;
    amountPaise: number;
  }[];
  recentActivity: {
    id: string;
    eventType: string;
    description: string;
    actor: string;
    createdAt: string;
  }[];
}

const EMPTY_METRICS: DashboardMetrics = {
  totals: {
    clients: 0,
    websites: 0,
    activeWebsites: 0,
    suspendedWebsites: 0,
    archivedWebsites: 0,
    upcomingRenewals: 0,
    expiredWebsites: 0,
    totalDevelopmentRevenuePaise: 0,
    totalAmcRevenuePaise: 0,
    totalRevenuePaise: 0,
    totalRefundsPaise: 0,
    outstandingPaise: 0,
    upcomingAmcRevenuePaise: 0,
  },
  amc: {
    enabled: 0,
    active: 0,
    upcoming: 0,
    expired: 0,
    overdue: 0,
    suspended: 0,
    exempt: 0,
    disabled: 0,
    amcPendingAmountPaise: 0,
  },
  charts: {
    monthlyRevenue: [],
    websiteStatusDistribution: [],
    revenueSplit: { development: 0, amc: 0, other: 0 },
  },
  upcomingRenewals: [],
  recentActivity: [],
};

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export async function getDashboardMetrics(
  client: SupabaseClient,
  filters: DashboardFilters = {}
): Promise<DashboardMetrics> {
  const businessDate = todayIST();

  const [
    clientsCountRes,
    websitesRes,
    amcRes,
    paymentsRes,
    invoicesRes,
    refundsRes,
    upcomingContractsRes,
    activityRes,
  ] = await Promise.all([
    client.from("clients").select("id", { count: "exact", head: true }).eq("archived", false),
    client.from("websites").select("id, status, archived").eq("archived", false),
    client.from("amc_contracts").select("status, access_status, enabled, exempt, renewal_price_paise, next_expiry_date, website_id"),
    client
      .from("payments")
      .select("amount_paise, purpose, status, payment_date, created_at")
      .eq("status", "successful")
      .gte("created_at", filters.dateFrom ? new Date(filters.dateFrom).toISOString() : "2000-01-01T00:00:00.000Z")
      .lte("created_at", filters.dateTo ? `${filters.dateTo}T23:59:59.999Z` : "2999-01-01T00:00:00.000Z"),
    client
      .from("invoices")
      .select("total_paise, amount_paid_paise, status")
      .not("status", "in", "(draft,cancelled)"),
    client.from("refunds").select("amount_paise").eq("status", "successful"),
    client
      .from("amc_contracts")
      .select(
        "*, website:websites(id, name, client_id, domains:website_domains(domain), client:clients(id, name))"
      )
      .not("next_expiry_date", "is", null)
      .order("next_expiry_date", { ascending: true })
      .limit(500),
    client.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(8),
  ]);

  if (clientsCountRes.error) throw clientsCountRes.error;

  const websites = websitesRes.data ?? [];
  const amcContracts = amcRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const refunds = refundsRes.data ?? [];
  const upcomingContracts = upcomingContractsRes.data ?? [];

  const statusCounts: Record<string, number> = {};
  for (const website of websites) {
    statusCounts[website.status] = (statusCounts[website.status] ?? 0) + 1;
  }

  const amcCounts = {
    enabled: amcContracts.filter((a) => a.enabled).length,
    active: amcContracts.filter((a) => a.status === "active").length,
    upcoming: amcContracts.filter((a) => a.status === "upcoming").length,
    expired: amcContracts.filter((a) => a.status === "expired").length,
    overdue: amcContracts.filter((a) => a.status === "overdue").length,
    suspended: amcContracts.filter((a) => a.status === "suspended" || a.access_status === "suspended").length,
    exempt: amcContracts.filter((a) => a.exempt).length,
    disabled: amcContracts.filter((a) => !a.enabled).length,
  };

  let totalDevelopment = 0;
  let totalAmc = 0;
  let totalOther = 0;
  for (const payment of payments) {
    const amount = Number(payment.amount_paise);
    if (payment.purpose === "development" || payment.purpose === "additional_development") {
      totalDevelopment += amount;
    } else if (payment.purpose === "amc_renewal") {
      totalAmc += amount;
    } else {
      totalOther += amount;
    }
  }

  const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount_paise), 0);
  const outstanding = invoices.reduce(
    (sum, invoice) => sum + Math.max(0, Number(invoice.total_paise) - Number(invoice.amount_paid_paise)),
    0
  );

  // Monthly revenue for the last 12 months.
  const monthlyMap = new Map<string, MonthlyRevenue>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    monthlyMap.set(key, { month: key, total: 0, development: 0, amc: 0, other: 0 });
  }
  for (const payment of payments) {
    const date = payment.payment_date ?? payment.created_at;
    if (!date) continue;
    const key = monthKey(date);
    const bucket = monthlyMap.get(key);
    if (!bucket) continue;
    const amount = Number(payment.amount_paise);
    bucket.total += amount;
    if (payment.purpose === "development" || payment.purpose === "additional_development") {
      bucket.development += amount;
    } else if (payment.purpose === "amc_renewal") {
      bucket.amc += amount;
    } else {
      bucket.other += amount;
    }
  }

  // Upcoming AMC revenue: contracts expiring within the next 90 days.
  const in90Days = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const upcomingAmcRevenue = upcomingContracts
    .filter((a) => a.next_expiry_date && a.next_expiry_date <= in90Days && a.access_status === "active")
    .reduce((sum, a) => sum + Number(a.renewal_price_paise), 0);

  const pendingRenewalAmount = upcomingContracts
    .filter((a) => ["upcoming", "overdue", "expired"].includes(a.status))
    .reduce((sum, a) => sum + Number(a.renewal_price_paise), 0);

  const upcomingRenewals = upcomingContracts.slice(0, 10).map((contract) => {
    const daysRemaining = contract.next_expiry_date
      ? Math.round(
          (new Date(contract.next_expiry_date + "T00:00:00Z").getTime() -
            new Date(businessDate + "T00:00:00Z").getTime()) /
            86_400_000
        )
      : 0;
    const domains = contract.website?.domains ?? [];
    return {
      websiteId: contract.website_id,
      websiteName: contract.website?.name ?? "—",
      clientId: contract.website?.client_id ?? "",
      clientName: contract.website?.client?.name ?? "—",
      domain:
        domains.find((d: { is_primary: boolean; domain: string }) => d.is_primary)?.domain ??
        domains[0]?.domain ??
        null,
      expiryDate: contract.next_expiry_date ?? "",
      daysRemaining,
      amountPaise: Number(contract.renewal_price_paise),
    };
  });

  const metrics: DashboardMetrics = {
    ...EMPTY_METRICS,
    totals: {
      clients: clientsCountRes.count ?? 0,
      websites: websites.length,
      activeWebsites: statusCounts["live"] ?? 0,
      suspendedWebsites: statusCounts["suspended"] ?? 0,
      archivedWebsites: statusCounts["archived"] ?? 0,
      upcomingRenewals: amcCounts.upcoming,
      expiredWebsites: amcCounts.expired + amcCounts.overdue + amcCounts.suspended,
      totalDevelopmentRevenuePaise: totalDevelopment,
      totalAmcRevenuePaise: totalAmc,
      totalRevenuePaise: totalDevelopment + totalAmc + totalOther,
      totalRefundsPaise: totalRefunds,
      outstandingPaise: outstanding,
      upcomingAmcRevenuePaise: upcomingAmcRevenue,
    },
    amc: {
      ...amcCounts,
      amcPendingAmountPaise: pendingRenewalAmount,
    },
    charts: {
      monthlyRevenue: Array.from(monthlyMap.values()),
      websiteStatusDistribution: Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      })),
      revenueSplit: { development: totalDevelopment, amc: totalAmc, other: totalOther },
    },
    upcomingRenewals,
    recentActivity: (activityRes.data ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      description: row.description,
      actor: row.actor,
      createdAt: row.created_at,
    })),
  };

  return metrics;
}
