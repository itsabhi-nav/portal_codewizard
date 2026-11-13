import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, MapPin, Phone, Globe, CreditCard, Wallet, AlertTriangle } from "lucide-react";
import { getSupabase } from "@/lib/supabase/server";
import { databaseReady } from "@/lib/database-ready";
import { DatabaseNotice } from "@/components/database-notice";
import { mapActivityLog, mapClient, mapPayment, mapWebsite } from "@/lib/mappers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { formatDateIST, formatDateTimeIST } from "@/lib/dates";
import { RecordPaymentButton, PaymentHistoryLink } from "@/components/payments/record-payment-button";
import { RemoveRecordButton } from "@/components/remove-record-button";
import { EditEntryButton } from "@/components/clients/edit-entry-button";
import { WebsiteIntegrationPanel, type IntegrationRow } from "@/components/clients/website-integration-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client Details" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!databaseReady()) {
    return <DatabaseNotice title="Client details" />;
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3200";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const integrationApiUrl = `${proto}://${host}`;

  const client = getSupabase();

  const { data: row, error } = await client.from("clients").select("*").eq("id", id).maybeSingle();
  if (error || !row) notFound();

  const [websitesRes, paymentsRes, activityRes] = await Promise.all([
    client
      .from("websites")
      .select("*, domains:website_domains(*)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    client.from("payments").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
    client.from("activity_logs").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  const mapped = mapClient(row);
  const websites = (websitesRes.data ?? []).map(mapWebsite);
  const payments = (paymentsRes.data ?? []).map(mapPayment);
  const activity = (activityRes.data ?? []).map(mapActivityLog);

  const websiteIds = websites.map((website) => website.id);
  const credentialsRes =
    websiteIds.length > 0
      ? await client
          .from("license_credentials")
          .select("website_id, public_id, secret_prefix, is_active")
          .in("website_id", websiteIds)
      : { data: [] };
  const integrationRows: IntegrationRow[] = websites.map((website) => {
    const credential = (credentialsRes.data ?? []).find((c) => c.website_id === website.id);
    return {
      websiteId: website.id,
      websiteName: website.name,
      publicId: credential?.public_id ?? website.publicId,
      secretPrefix: credential?.secret_prefix ?? null,
      isActive: credential?.is_active ?? false,
    };
  });

  const successful = payments.filter((p) => p.status === "successful");
  const totalPaid = successful.reduce((sum, p) => sum + p.amountPaise, 0);
  const totalCharged = websites.reduce(
    (sum, w) => sum + w.developmentCostPaise + w.domainChargePaise + w.hostingChargePaise,
    0
  );
  const outstanding = Math.max(0, totalCharged - totalPaid);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/admin/clients">
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{mapped.name}</h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {mapped.clientCode} {mapped.businessName ? `· ${mapped.businessName}` : ""}
            </p>
          </div>
          {mapped.archived && <Badge variant="secondary">Archived</Badge>}
        </div>
        <div className="mobile-actions">
          <WhatsAppButton
            number={mapped.whatsappNumber || mapped.mobile}
            message={`Hello ${mapped.name}, this is CodeWizard.`}
            label="WhatsApp"
          />
          <RecordPaymentButton
            clientId={mapped.id}
            clients={[mapped]}
            websites={websites.map((w) => ({ id: w.id, clientId: w.clientId, name: w.name }))}
            purpose="advance"
            size="default"
            label="Payment"
          />
          <PaymentHistoryLink clientId={mapped.id} size="default" label="Payment History" />
          <RemoveRecordButton
            entity="client"
            id={mapped.id}
            name={mapped.name}
            redirectTo="/admin/clients"
            withLabel
          />
          <EditEntryButton client={mapped} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Websites" value={String(websites.length)} icon={<Globe className="h-5 w-5" />} accent="blue" />
        <StatCard title="Total Charged" value={formatINR(totalCharged)} icon={<Wallet className="h-5 w-5" />} accent="violet" />
        <StatCard title="Total Paid" value={formatINR(totalPaid)} icon={<CreditCard className="h-5 w-5" />} accent="emerald" />
        <StatCard
          title="Outstanding"
          value={formatINR(outstanding)}
          icon={<Wallet className="h-5 w-5" />}
          accent={outstanding > 0 ? "amber" : "emerald"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> {mapped.contactPerson || "—"}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" /> {mapped.mobile || "—"}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" /> {mapped.email || "—"}
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>
                {[mapped.address, mapped.city, mapped.state, mapped.pinCode].filter(Boolean).join(", ") || "—"}
              </span>
            </p>
            {mapped.notes && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{mapped.notes}</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Websites</CardTitle>
          </CardHeader>
          <CardContent>
            {websites.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No websites yet.</p>
            ) : (
              <>
                <div className="divide-y md:hidden">
                  {websites.map((website) => {
                    const primary = website.domains?.find((d) => d.isPrimary)?.domain ?? website.domains?.[0]?.domain ?? null;
                    const total =
                      website.developmentCostPaise + website.domainChargePaise + website.hostingChargePaise;
                    return (
                      <div key={website.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/admin/websites/${website.id}`}
                              className="block truncate text-sm font-medium hover:text-primary"
                            >
                              {website.name}
                            </Link>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {primary ?? "No domain"} · go-live {formatDateIST(website.goLiveDate)}
                            </p>
                          </div>
                          <StatusBadge status={website.status} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-center">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dev</p>
                            <p className="text-xs font-medium tabular-nums">{formatINR(website.developmentCostPaise)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Domain</p>
                            <p className="text-xs font-medium tabular-nums">{formatINR(website.domainChargePaise)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hosting</p>
                            <p className="text-xs font-medium tabular-nums">{formatINR(website.hostingChargePaise)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">Total charged</span>
                          <span className="font-semibold">{formatINR(total)}</span>
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <RecordPaymentButton
                            clientId={mapped.id}
                            websiteId={website.id}
                            clients={[mapped]}
                            websites={websites.map((w) => ({ id: w.id, clientId: w.clientId, name: w.name }))}
                            purpose="advance"
                            size="sm"
                            label="Payment"
                          />
                          <PaymentHistoryLink clientId={mapped.id} websiteId={website.id} size="sm" label="History" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Website</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Dev ₹</TableHead>
                        <TableHead>Charges</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Go-live</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {websites.map((website) => (
                        <TableRow key={website.id}>
                          <TableCell className="font-medium">
                            <Link href={`/admin/websites/${website.id}`} className="hover:text-primary">
                              {website.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">
                            {website.domains?.find((d) => d.isPrimary)?.domain ? (
                              <a
                                href={`https://${website.domains.find((d) => d.isPrimary)!.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {website.domains.find((d) => d.isPrimary)!.domain}
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{formatINR(website.developmentCostPaise)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div>Domain: {formatINR(website.domainChargePaise)}</div>
                            <div>Hosting: {formatINR(website.hostingChargePaise)}</div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatINR(website.developmentCostPaise + website.domainChargePaise + website.hostingChargePaise)}
                          </TableCell>
                          <TableCell>{formatDateIST(website.goLiveDate)}</TableCell>
                          <TableCell>
                            <StatusBadge status={website.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <RecordPaymentButton
                                clientId={mapped.id}
                                websiteId={website.id}
                                clients={[mapped]}
                                websites={websites.map((w) => ({ id: w.id, clientId: w.clientId, name: w.name }))}
                                purpose="advance"
                                size="sm"
                                label="Pay"
                              />
                              <PaymentHistoryLink clientId={mapped.id} websiteId={website.id} size="sm" label="History" />
                            </div>
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

      <WebsiteIntegrationPanel rows={integrationRows} apiUrl={integrationApiUrl} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Payments</CardTitle>
            <PaymentHistoryLink clientId={mapped.id} size="sm" label="View All" />
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto scrollbar-thin">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{payment.paymentCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateIST(payment.paymentDate ?? payment.createdAt)} · {payment.purpose.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatINR(payment.amountPaise)}</p>
                      <StatusBadge status={payment.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-0">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{entry.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.actor} · {formatDateTimeIST(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {outstanding > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Outstanding balance of {formatINR(outstanding)} is pending for this client.
        </div>
      )}
    </div>
  );
}
