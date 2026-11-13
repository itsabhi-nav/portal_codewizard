"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Globe,
  Play,
  Pause,
  Plus,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Settings2,
  CalendarClock,
  IndianRupee,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { RecordPaymentButton, PaymentHistoryLink } from "@/components/payments/record-payment-button";
import { WebsiteFormDialog } from "@/components/websites/website-form-dialog";
import { DomainDialog } from "@/components/websites/domain-dialog";
import { AmcConfigDialog, AmcExtendDialog, QuoteDialog } from "@/components/websites/amc-dialogs";
import { ManualRenewDialog } from "@/components/websites/manual-renew-dialog";
import { PaymentFormDialog } from "@/components/payments/payment-form-dialog";
import { RemoveRecordButton } from "@/components/remove-record-button";
import { formatINR } from "@/lib/money";
import { formatDateIST, formatDateTimeIST, relativeDays } from "@/lib/dates";
import type {
  ActivityLog,
  AmcContract,
  AmcPeriod,
  Client,
  Invoice,
  LicenseCredential,
  Payment,
  RenewalQuote,
  RazorpayOrder,
  Website,
} from "@/lib/types";
import type { AmcStatusResult } from "@/lib/amc";

export interface WebsiteDetailData {
  website: Website;
  client: Client | null;
  payments: Payment[];
  invoices: Invoice[];
  amc: AmcContract | null;
  liveStatus: AmcStatusResult | null;
  periods: AmcPeriod[];
  quotes: RenewalQuote[];
  orders: RazorpayOrder[];
  credential: LicenseCredential | null;
  settings: { customSuspensionTitle: string | null; customSuspensionBody: string | null } | null;
  activity: ActivityLog[];
  summary: { totalPaidPaise: number; developmentPaidPaise: number; amcPaidPaise: number };
  clients: Client[];
  websites: Array<{ id: string; clientId: string; name: string }>;
}

export function WebsiteDetail({ data, initialTab = "overview" }: { data: WebsiteDetailData; initialTab?: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editOpen, setEditOpen] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [amcOpen, setAmcOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { website, client, amc, liveStatus, credential } = data;

  async function suspendWebsite() {
    const response = await fetch(`/api/admin/websites/${website.id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Manually suspended from admin portal" }),
    });
    const json = await response.json();
    if (json.success) {
      toast.success("Website suspended");
      router.refresh();
    } else {
      toast.error(json?.error?.message ?? "Failed to suspend");
    }
  }

  async function reactivateWebsite() {
    const response = await fetch(`/api/admin/websites/${website.id}/reactivate`, { method: "POST" });
    const json = await response.json();
    if (json.success) {
      toast.success("Website reactivated");
      router.refresh();
    } else {
      toast.error(json?.error?.message ?? "Failed to reactivate");
    }
  }

  async function toggleExempt() {
    const response = await fetch(`/api/admin/websites/${website.id}/exempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exempt: !amc?.exempt }),
    });
    const json = await response.json();
    if (json.success) {
      toast.success(amc?.exempt ? "Exemption removed" : "Website exempted from AMC");
      router.refresh();
    } else {
      toast.error(json?.error?.message ?? "Failed to update exemption");
    }
  }

  async function rotateCredential() {
    const response = await fetch(`/api/admin/websites/${website.id}/license`, { method: "POST" });
    const json = await response.json();
    if (json.success) {
      setRotatedSecret(json.data.secret);
      setCopied(false);
    } else {
      toast.error(json?.error?.message ?? "Failed to rotate credential");
    }
  }

  async function copySecret() {
    if (!rotatedSecret) return;
    await navigator.clipboard.writeText(rotatedSecret);
    setCopied(true);
    toast.success("Secret copied");
  }

  const primaryDomain = website.domains?.find((d) => d.isPrimary)?.domain ?? website.domains?.[0]?.domain ?? null;

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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{website.name}</h1>
              <StatusBadge status={website.status} />
              {liveStatus && amc?.enabled && !amc.exempt && <StatusBadge status={liveStatus.status} />}
            </div>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {website.publicId} {client ? `· ${client.name}` : ""}
            </p>
          </div>
        </div>
        <div className="mobile-actions">
          <WhatsAppButton
            number={client?.whatsappNumber || client?.mobile}
            message={`Hello ${client?.name ?? ""}, regarding your website ${website.name}.`}
            label="WhatsApp"
          />
          <RecordPaymentButton
            clientId={website.clientId}
            websiteId={website.id}
            clients={data.clients}
            websites={data.websites}
            defaultAmountPaise={website.developmentCostPaise}
            purpose="advance"
            size="default"
            label="Payment"
          />
          <PaymentHistoryLink clientId={website.clientId} websiteId={website.id} label="History" />
          <Button variant="outline" onClick={() => setDomainOpen(true)}>
            <Globe className="mr-2 h-4 w-4" /> Update Domain
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          {website.status === "suspended" ? (
            <Button variant="gradient" onClick={reactivateWebsite}>
              <Play className="mr-2 h-4 w-4" /> Reactivate
            </Button>
          ) : (
            <Button variant="outline" onClick={suspendWebsite}>
              <Pause className="mr-2 h-4 w-4" /> Suspend
            </Button>
          )}
          <RemoveRecordButton
            entity="website"
            id={website.id}
            name={website.name}
            redirectTo="/admin/clients"
            withLabel
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Development Cost" value={formatINR(website.developmentCostPaise)} icon={<IndianRupee className="h-5 w-5" />} accent="blue" />
        <StatCard title="Total Paid" value={formatINR(data.summary.totalPaidPaise)} icon={<IndianRupee className="h-5 w-5" />} accent="emerald" />
        <StatCard title="AMC Paid" value={formatINR(data.summary.amcPaidPaise)} icon={<RefreshCw className="h-5 w-5" />} accent="violet" />
        <StatCard
          title="Renewal Amount"
          value={amc ? formatINR(amc.negotiatedPricePaise ?? amc.renewalPricePaise) : "—"}
          subtitle={liveStatus ? relativeDays(liveStatus.daysRemaining ?? 0) : undefined}
          icon={<CalendarClock className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="-mx-3 flex w-[calc(100%+1.5rem)] flex-nowrap justify-start overflow-x-auto rounded-none px-3 sm:mx-0 sm:w-full sm:justify-center sm:rounded-lg sm:px-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="amc">AMC & Validity</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="license">License Configuration</TabsTrigger>
          <TabsTrigger value="activity">Activity History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Website Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="Website ID" value={website.id} mono />
                <DetailRow label="Public ID" value={website.publicId} mono />
                <DetailRow
                  label="License Secret"
                  value={
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs">
                        {credential ? `••••${credential.secretPrefix ?? ""}` : "Not provisioned"}
                      </span>
                      {credential && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={rotateCredential}
                        >
                          <KeyRound className="mr-1 h-3 w-3" /> Regenerate
                        </Button>
                      )}
                    </span>
                  }
                />
                <DetailRow label="Client" value={client?.name ?? "—"} />
                <DetailRow label="Domain" value={primaryDomain ? (
                  <a href={`https://${primaryDomain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    {primaryDomain} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : "—"} />
                <DetailRow label="Project Start" value={formatDateIST(website.projectStartDate)} />
                <DetailRow label="Go-live" value={formatDateIST(website.goLiveDate)} />
                <DetailRow label="Hosting" value={website.hostingProvider || "—"} />
                <DetailRow label="Development Cost" value={formatINR(website.developmentCostPaise)} />
                <DetailRow
                  label="Domain Charge"
                  value={formatINR(website.domainChargePaise)}
                />
                <DetailRow
                  label="Hosting Charge"
                  value={formatINR(website.hostingChargePaise)}
                />
                <DetailRow
                  label="Total Charged"
                  value={
                    <span className="font-semibold text-primary">
                      {formatINR(website.developmentCostPaise + website.domainChargePaise + website.hostingChargePaise)}
                    </span>
                  }
                />
                <DetailRow label="Status" value={<StatusBadge status={website.status} />} />
                {website.description && <DetailRow label="Description" value={website.description} />}
                {website.notes && <DetailRow label="Notes" value={website.notes} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Domain History</CardTitle>
              </CardHeader>
              <CardContent>
                {website.domains?.length ? (
                  <div className="space-y-2">
                    {website.domains.map((domain) => (
                      <div key={domain.id} className="flex flex-col gap-1 border-b border-border/50 pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                          <span className="break-all">{domain.domain}</span>
                          {domain.isPrimary && <Badge variant="info">primary</Badge>}
                          {!domain.active && <Badge variant="secondary">inactive</Badge>}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDateIST(domain.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">No domains configured.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Payments</CardTitle>
              <Button size="sm" onClick={() => setPaymentOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Record Payment
              </Button>
            </CardHeader>
            <CardContent>
              {data.payments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.paymentCode}</TableCell>
                        <TableCell>{formatDateIST(payment.paymentDate ?? payment.createdAt)}</TableCell>
                        <TableCell className="text-sm">{payment.purpose.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-sm">{payment.method.replace(/_/g, " ")}</TableCell>
                        <TableCell>{formatINR(payment.amountPaise)}</TableCell>
                        <TableCell>
                          <StatusBadge status={payment.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amc">
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">AMC & Validity</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAmcOpen(true)}>
                    <Settings2 className="mr-2 h-4 w-4" /> {amc ? "Edit AMC" : "Configure AMC"}
                  </Button>
                  {amc && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setExtendOpen(true)}>
                        <CalendarClock className="mr-2 h-4 w-4" /> Extend Validity
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setQuoteOpen(true)}>
                        <IndianRupee className="mr-2 h-4 w-4" /> Change Price
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRenewOpen(true)}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Record Renewal
                      </Button>
                      <Button size="sm" variant="outline" onClick={toggleExempt}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> {amc.exempt ? "Remove Exemption" : "Exempt"}
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!amc ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">AMC is not configured for this website.</p>
                    <Button className="mt-4" onClick={() => setAmcOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Configure AMC
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <AmcStat label="Business Status" value={<StatusBadge status={liveStatus?.status ?? amc.status} />} />
                    <AmcStat label="Access" value={<StatusBadge status={amc.accessStatus} />} />
                    <AmcStat label="Validity" value={`${formatDateIST(amc.validityStart)} → ${formatDateIST(amc.validityEnd)}`} />
                    <AmcStat label="Next Expiry" value={formatDateIST(amc.nextExpiryDate)} />
                    <AmcStat label="Renewal Price" value={formatINR(amc.renewalPricePaise)} />
                    <AmcStat
                      label="Negotiated Price"
                      value={amc.negotiatedPricePaise ? formatINR(amc.negotiatedPricePaise) : "—"}
                    />
                    <AmcStat label="Billing Period" value={`${amc.billingPeriodDays} days`} />
                    <AmcStat
                      label="Threshold / Grace"
                      value={`${amc.upcomingThresholdDays} / ${amc.gracePeriodDays} days`}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">AMC Periods</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.periods.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No AMC periods yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.periods.map((period) => (
                          <TableRow key={period.id}>
                            <TableCell>{formatDateIST(period.startDate)}</TableCell>
                            <TableCell>{formatDateIST(period.endDate)}</TableCell>
                            <TableCell>{formatINR(period.pricePaise)}</TableCell>
                            <TableCell>
                              <StatusBadge status={period.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Renewal Quotes</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.quotes.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No quotes yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Amount</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Effective</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.quotes.map((quote) => (
                          <TableRow key={quote.id}>
                            <TableCell>{formatINR(quote.amountPaise)}</TableCell>
                            <TableCell>
                              {quote.discountPaise > 0 ? formatINR(quote.discountPaise) : "—"}
                            </TableCell>
                            <TableCell className="text-xs">{quote.quoteType.replace(/_/g, " ")}</TableCell>
                            <TableCell>{formatDateIST(quote.effectiveDate)}</TableCell>
                            <TableCell>
                              <StatusBadge status={quote.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Razorpay Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {data.orders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No online transactions yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                        <TableCell>{formatINR(order.amountPaise)}</TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell>{formatDateTimeIST(order.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="license">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">License Credential</CardTitle>
                {credential && (
                  <Button size="sm" variant="outline" onClick={rotateCredential}>
                    <KeyRound className="mr-2 h-4 w-4" /> Rotate Secret
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {credential ? (
                  <>
                    <DetailRow label="Public ID" value={credential.publicId} mono />
                    <DetailRow label="Secret Prefix" value={`••••${credential.secretPrefix ?? ""}`} mono />
                    <DetailRow label="Active" value={credential.isActive ? "Yes" : "No"} />
                    <DetailRow label="Last Rotated" value={formatDateTimeIST(credential.lastRotatedAt)} />
                  </>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">No credential provisioned.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Client Website Integration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Add these environment variables to the client website (server-side only):</p>
                <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs text-foreground scrollbar-thin">
{`CODEWIZARD_API_URL=https://your-codewizard-app.com
CODEWIZARD_WEBSITE_ID=${credential?.publicId ?? "<public_id>"}
CODEWIZARD_WEBSITE_SECRET=${credential ? "••••••••" : "<secret>"}`}
                </pre>
                <p>
                  Then add the shared middleware and call{" "}
                  <code className="rounded bg-muted px-1 text-xs">verifyLicense()</code> on the server before
                  serving protected routes. See{" "}
                  <Link href="/admin/settings" className="text-primary hover:underline">
                    CLIENT-WEBSITE-INTEGRATION.md
                  </Link>
                  .
                </p>
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                  Never expose CODEWIZARD_WEBSITE_SECRET to the browser (no NEXT_PUBLIC_ prefix).
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              {data.activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded.</p>
              ) : (
                <div className="space-y-3">
                  {data.activity.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-0">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{entry.description}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {entry.actor} · {formatDateTimeIST(entry.createdAt)} · {entry.eventType}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <WebsiteFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={website}
        clients={data.clients}
        onSuccess={() => router.refresh()}
      />
      <DomainDialog open={domainOpen} onOpenChange={setDomainOpen} websiteId={website.id} onSuccess={() => router.refresh()} />
      <AmcConfigDialog open={amcOpen} onOpenChange={setAmcOpen} websiteId={website.id} contract={amc} onSuccess={() => router.refresh()} />
      <AmcExtendDialog open={extendOpen} onOpenChange={setExtendOpen} websiteId={website.id} onSuccess={() => router.refresh()} />
      <QuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} websiteId={website.id} contract={amc} onSuccess={() => router.refresh()} />
      <ManualRenewDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        websiteId={website.id}
        defaultAmount={amc ? amc.negotiatedPricePaise ?? amc.renewalPricePaise : undefined}
        onSuccess={() => router.refresh()}
      />
      <PaymentFormDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        clients={data.clients}
        websites={data.websites}
        preset={{ clientId: website.clientId, websiteId: website.id }}
        onSuccess={() => router.refresh()}
      />

      <Dialog open={Boolean(rotatedSecret)} onOpenChange={(next) => !next && setRotatedSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> New License Secret
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy the new secret now. The old secret is no longer valid.
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all text-xs">{rotatedSecret}</code>
              <Button variant="outline" size="icon" onClick={copySecret}>
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={() => setRotatedSecret(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 text-xs last:border-0 sm:gap-4 sm:text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words text-right ${mono ? "font-mono text-[11px] sm:text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function AmcStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
