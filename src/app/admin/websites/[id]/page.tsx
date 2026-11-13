import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import {
  mapActivityLog,
  mapAmcContract,
  mapAmcPeriod,
  mapClient,
  mapInvoice,
  mapLicenseCredential,
  mapPayment,
  mapRenewalQuote,
  mapRazorpayOrder,
  mapWebsite,
} from "@/lib/mappers";
import { computeAmcStatus } from "@/lib/amc";
import { todayIST } from "@/lib/dates";
import { WebsiteDetail } from "@/components/websites/website-detail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website Details" };

export default async function WebsiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  if (!databaseReady()) {
    return <DatabaseNotice title="Website details" />;
  }

  const client = getSupabase();

  const { data: row, error } = await client
    .from("websites")
    .select("*, client:clients(*), domains:website_domains(*)")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) notFound();

  const [
    paymentsRes,
    invoicesRes,
    amcRes,
    periodsRes,
    quotesRes,
    ordersRes,
    credentialRes,
    settingsRes,
    activityRes,
    clientsRes,
    websitesRes,
  ] = await Promise.all([
    client.from("payments").select("*").eq("website_id", id).order("created_at", { ascending: false }).limit(200),
    client.from("invoices").select("*").eq("website_id", id).order("created_at", { ascending: false }).limit(100),
    client.from("amc_contracts").select("*").eq("website_id", id).maybeSingle(),
    client.from("amc_periods").select("*").eq("website_id", id).order("start_date", { ascending: false }),
    client.from("renewal_quotes").select("*").eq("website_id", id).order("created_at", { ascending: false }),
    client.from("razorpay_orders").select("*").eq("website_id", id).order("created_at", { ascending: false }).limit(100),
    client
      .from("license_credentials")
      .select("id, website_id, public_id, secret_prefix, is_active, last_rotated_at, created_at, updated_at")
      .eq("website_id", id)
      .maybeSingle(),
    client.from("website_settings").select("*").eq("website_id", id).maybeSingle(),
    client.from("activity_logs").select("*").eq("website_id", id).order("created_at", { ascending: false }).limit(100),
    client.from("clients").select("*").eq("archived", false).order("name", { ascending: true }),
    client.from("websites").select("id, client_id, name, status").eq("archived", false),
  ]);

  const amc = amcRes.data ? mapAmcContract(amcRes.data) : null;
  const businessDate = todayIST();
  const liveStatus = amc
    ? computeAmcStatus({
        enabled: amc.enabled,
        exempt: amc.exempt,
        validityEnd: amc.validityEnd,
        businessDate,
        upcomingThresholdDays: amc.upcomingThresholdDays,
        gracePeriodDays: amc.gracePeriodDays,
      })
    : null;

  const payments = (paymentsRes.data ?? []).map(mapPayment);
  const successful = payments.filter((p) => p.status === "successful");

  return (
    <WebsiteDetail
      initialTab={tab ?? "overview"}
      data={{
        website: mapWebsite(row),
        client: row.client ? mapClient(row.client) : null,
        payments,
        invoices: (invoicesRes.data ?? []).map(mapInvoice),
        amc,
        liveStatus,
        periods: (periodsRes.data ?? []).map(mapAmcPeriod),
        quotes: (quotesRes.data ?? []).map(mapRenewalQuote),
        orders: (ordersRes.data ?? []).map(mapRazorpayOrder),
        credential: credentialRes.data ? mapLicenseCredential(credentialRes.data) : null,
        settings: settingsRes.data
          ? {
              customSuspensionTitle: settingsRes.data.custom_suspension_title ?? null,
              customSuspensionBody: settingsRes.data.custom_suspension_body ?? null,
            }
          : null,
        activity: (activityRes.data ?? []).map(mapActivityLog),
        summary: {
          totalPaidPaise: successful.reduce((sum, p) => sum + p.amountPaise, 0),
          developmentPaidPaise: successful
            .filter((p) => p.purpose === "development" || p.purpose === "additional_development")
            .reduce((sum, p) => sum + p.amountPaise, 0),
          amcPaidPaise: successful
            .filter((p) => p.purpose === "amc_renewal")
            .reduce((sum, p) => sum + p.amountPaise, 0),
        },
        clients: (clientsRes.data ?? []).map(mapClient),
        websites: (websitesRes.data ?? []).map((w) => ({
          id: w.id,
          clientId: w.client_id,
          name: w.name,
        })),
      }}
    />
  );
}
