import { getSupabase } from "@/lib/supabase/server";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { computeAmcStatus } from "@/lib/amc";
import { todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { AmcTable, type AmcRow } from "@/components/amc/amc-table";
import { RefreshCw, CheckCircle2, Clock, AlertTriangle, Ban, ShieldCheck, IndianRupee, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "AMC & Renewals" };

export default async function AmcPage() {
  if (!databaseReady()) {
    return <DatabaseNotice title="AMC & Renewals" />;
  }

  const client = getSupabase();
  const businessDate = todayIST();

  const [contractsRes, amcPaymentsRes] = await Promise.all([
    client
      .from("amc_contracts")
      .select(
        "*, website:websites(id, name, public_id, client_id, domains:website_domains(domain, is_primary), client:clients(id, name, mobile, whatsapp_number), settings:website_settings(reminders_enabled))"
      )
      .order("created_at", { ascending: false }),
    client.from("payments").select("amount_paise").eq("purpose", "amc_renewal").eq("status", "successful"),
  ]);
  const contracts = contractsRes.data;

  const rows: AmcRow[] = (contracts ?? []).map((contract) => {
    const website = contract.website;
    const clientRow = website?.client;
    const domains = website?.domains ?? [];
    const status = computeAmcStatus({
      enabled: contract.enabled,
      exempt: contract.exempt,
      validityEnd: contract.validity_end,
      businessDate,
      upcomingThresholdDays: contract.upcoming_threshold_days,
      gracePeriodDays: contract.grace_period_days,
    });

    return {
      contractId: contract.id,
      websiteId: contract.website_id,
      websiteName: website?.name ?? "—",
      publicId: website?.public_id ?? "",
      clientId: website?.client_id ?? "",
      clientName: clientRow?.name ?? "—",
      domain:
        domains.find((d: { is_primary: boolean; domain: string }) => d.is_primary)?.domain ??
        domains[0]?.domain ??
        null,
      whatsappNumber: clientRow?.whatsapp_number ?? clientRow?.mobile ?? null,
      enabled: contract.enabled,
      exempt: contract.exempt,
      status: status.status,
      accessStatus: contract.access_status,
      daysRemaining: status.daysRemaining,
      daysOverdue: status.daysOverdue,
      renewalAmountPaise: Number(contract.negotiated_price_paise ?? contract.renewal_price_paise),
      negotiatedAmountPaise: contract.negotiated_price_paise === null ? null : Number(contract.negotiated_price_paise),
      validityStart: contract.validity_start,
      validityEnd: contract.validity_end,
      nextExpiryDate: contract.validity_end,
      upcomingThresholdDays: contract.upcoming_threshold_days,
    };
  });

  const counts = {
    enabled: rows.filter((r) => r.enabled).length,
    active: rows.filter((r) => r.status === "active").length,
    upcoming: rows.filter((r) => r.status === "upcoming").length,
    expired: rows.filter((r) => r.status === "expired").length,
    overdue: rows.filter((r) => r.status === "overdue").length,
    suspended: rows.filter((r) => r.status === "suspended" || r.accessStatus === "suspended" || r.accessStatus === "manual_suspended").length,
    exempt: rows.filter((r) => r.exempt).length,
    disabled: rows.filter((r) => !r.enabled).length,
    potential: rows.filter((r) => r.enabled && !r.exempt).reduce((sum, r) => sum + r.renewalAmountPaise, 0),
    pending: rows
      .filter((r) => ["upcoming", "overdue", "expired", "suspended"].includes(r.status))
      .reduce((sum, r) => sum + r.renewalAmountPaise, 0),
  };

  const amcRevenue = (amcPaymentsRes.data ?? []).reduce((sum, p) => sum + Number(p.amount_paise), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="AMC & Renewals"
        description="Track annual maintenance contracts, expiry, grace periods and renewals."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="AMC Enabled" value={String(counts.enabled)} subtitle={`${counts.disabled} disabled`} icon={<RefreshCw className="h-5 w-5" />} accent="blue" />
        <StatCard title="Active" value={String(counts.active)} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
        <StatCard title="Upcoming" value={String(counts.upcoming)} subtitle="Within threshold" icon={<Clock className="h-5 w-5" />} accent="cyan" />
        <StatCard title="Expired / Overdue" value={String(counts.expired + counts.overdue)} icon={<AlertTriangle className="h-5 w-5" />} accent="amber" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Suspended" value={String(counts.suspended)} icon={<Ban className="h-5 w-5" />} accent="rose" />
        <StatCard title="Exempt" value={String(counts.exempt)} icon={<ShieldCheck className="h-5 w-5" />} accent="violet" />
        <StatCard title="AMC Revenue" value={formatINR(amcRevenue)} subtitle="Collected" icon={<IndianRupee className="h-5 w-5" />} accent="emerald" />
        <StatCard title="Pending Renewals" value={formatINR(counts.pending)} subtitle={`Potential ${formatINR(counts.potential)}`} icon={<Wallet className="h-5 w-5" />} accent="amber" />
      </div>

      <AmcTable rows={rows} />
    </div>
  );
}
