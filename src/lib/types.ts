/**
 * Domain types used across the application (camelCase).
 * Database rows (snake_case) are mapped via `mappers.ts`.
 */

export type WebsiteStatus = "development" | "testing" | "live" | "suspended" | "archived";
export type PaymentMethod = "razorpay" | "upi" | "bank_transfer" | "cash" | "other";
export type PaymentPurpose = "development" | "amc_renewal" | "additional_development" | "hosting" | "other";
export type PaymentStatus = "created" | "pending" | "successful" | "failed" | "refunded" | "partially_refunded";
export type InvoiceStatus = "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
export type InvoiceType = "development" | "amc" | "additional_service" | "hosting" | "other";

export interface Client {
  id: string;
  clientCode: string;
  name: string;
  businessName: string | null;
  contactPerson: string | null;
  mobile: string | null;
  whatsappNumber: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  notes: string | null;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebsiteDomain {
  id: string;
  websiteId: string;
  domain: string;
  isPrimary: boolean;
  active: boolean;
  createdAt: string;
}

export interface Website {
  id: string;
  publicId: string;
  clientId: string;
  name: string;
  description: string | null;
  projectStartDate: string | null;
  goLiveDate: string | null;
  developmentCostPaise: number;
  domainChargePaise: number;
  hostingChargePaise: number;
  domainChargeFrequency: "one_time" | "annual";
  hostingChargeFrequency: "one_time" | "annual";
  status: WebsiteStatus;
  hostingProvider: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  domains?: WebsiteDomain[];
  client?: Client | null;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  amountPaise: number;
  taxRatePercent: number;
  sortOrder: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  websiteId: string | null;
  invoiceType: InvoiceType;
  issueDate: string;
  dueDate: string | null;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  amountPaidPaise: number;
  status: InvoiceStatus;
  taxRatePercent: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItem[];
  client?: Client | null;
  website?: Website | null;
}

export interface Payment {
  id: string;
  paymentCode: string;
  clientId: string;
  websiteId: string | null;
  invoiceId: string | null;
  amountPaise: number;
  currency: string;
  method: PaymentMethod;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  transactionRef: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paymentDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client | null;
  website?: Website | null;
  invoice?: Invoice | null;
}

export interface Refund {
  id: string;
  refundCode: string;
  paymentId: string;
  invoiceId: string | null;
  amountPaise: number;
  reason: string | null;
  status: "pending" | "successful" | "failed";
  razorpayRefundId: string | null;
  createdAt: string;
}

export interface AmcContract {
  id: string;
  websiteId: string;
  enabled: boolean;
  exempt: boolean;
  originalPricePaise: number;
  renewalPricePaise: number;
  negotiatedPricePaise: number | null;
  billingPeriodDays: number;
  upcomingThresholdDays: number;
  gracePeriodDays: number;
  validityStart: string | null;
  validityEnd: string | null;
  lastRenewalDate: string | null;
  nextExpiryDate: string | null;
  status: string;
  accessStatus: string;
  suspensionReason: string | null;
  suspendedAt: string | null;
  autoRenewal: boolean;
  razorpaySubscriptionId: string | null;
  subscriptionStatus: string | null;
  mandateStatus: string | null;
  nextBillingDate: string | null;
  cancellationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AmcPeriod {
  id: string;
  amcContractId: string;
  websiteId: string;
  startDate: string;
  endDate: string;
  pricePaise: number;
  paymentId: string | null;
  status: "active" | "expired" | "renewed" | "cancelled";
  notes: string | null;
  createdAt: string;
}

export interface RenewalQuote {
  id: string;
  websiteId: string;
  amcContractId: string;
  amountPaise: number;
  originalAmountPaise: number;
  discountPaise: number;
  discountPercent: number | null;
  quoteType: "default" | "one_time_discount" | "permanent_price_change" | "manual";
  reason: string | null;
  adminNotes: string | null;
  effectiveDate: string;
  quoteExpiryDate: string | null;
  status: "active" | "expired" | "superseded" | "used" | "cancelled";
  razorpayOrderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseCredential {
  id: string;
  websiteId: string;
  websiteUuid: string;
  publicId: string;
  secretHash: string;
  secretPrefix: string | null;
  isActive: boolean;
  lastRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  eventType: string;
  clientId: string | null;
  websiteId: string | null;
  actor: string;
  description: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "success";
  relatedClientId: string | null;
  relatedWebsiteId: string | null;
  isRead: boolean;
  dedupeKey: string | null;
  createdAt: string;
}

export interface CronExecutionLog {
  id: string;
  runId: string;
  trigger: "scheduled" | "manual";
  status: "running" | "success" | "failed" | "partial";
  startedAt: string;
  finishedAt: string | null;
  websitesProcessed: number;
  upcomingCount: number;
  expiredCount: number;
  overdueCount: number;
  newlySuspended: number;
  errors: unknown[];
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  key: string;
  name: string;
  subject: string | null;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLog {
  id: string;
  templateKey: string;
  websiteId: string | null;
  clientId: string | null;
  channel: string;
  recipient: string | null;
  message: string | null;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  reminderInterval: number | null;
  periodKey: string | null;
  createdAt: string;
}

export interface RazorpayOrder {
  id: string;
  orderId: string;
  internalOrderRef: string;
  websiteId: string | null;
  clientId: string | null;
  paymentId: string | null;
  quoteId: string | null;
  amountPaise: number;
  currency: string;
  status: string;
  receipt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RazorpayWebhookEvent {
  id: string;
  eventId: string;
  eventName: string;
  paymentId: string | null;
  orderId: string | null;
  status: "received" | "processed" | "ignored" | "failed";
  error: string | null;
  createdAt: string;
  processedAt: string | null;
}
