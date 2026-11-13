import type {
  ActivityLog,
  AdminNotification,
  AmcContract,
  AmcPeriod,
  Client,
  CronExecutionLog,
  Invoice,
  InvoiceItem,
  LicenseCredential,
  NotificationLog,
  NotificationTemplate,
  Payment,
  Refund,
  RenewalQuote,
  RazorpayOrder,
  RazorpayWebhookEvent,
  Website,
  WebsiteDomain,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapClient(row: any): Client {
  return {
    id: row.id,
    clientCode: row.client_code,
    name: row.name,
    businessName: row.business_name ?? null,
    contactPerson: row.contact_person ?? null,
    mobile: row.mobile ?? null,
    whatsappNumber: row.whatsapp_number ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    pinCode: row.pin_code ?? null,
    notes: row.notes ?? null,
    archived: Boolean(row.archived),
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWebsite(row: any): Website {
  const website: Website = {
    id: row.id,
    publicId: row.public_id,
    clientId: row.client_id,
    name: row.name,
    description: row.description ?? null,
    projectStartDate: row.project_start_date ?? null,
    goLiveDate: row.go_live_date ?? null,
    developmentCostPaise: Number(row.development_cost_paise ?? 0),
    domainChargePaise: Number(row.domain_charge_paise ?? 0),
    hostingChargePaise: Number(row.hosting_charge_paise ?? 0),
    domainChargeFrequency: row.domain_charge_frequency ?? "annual",
    hostingChargeFrequency: row.hosting_charge_frequency ?? "annual",
    status: row.status,
    hostingProvider: row.hosting_provider ?? null,
    notes: row.notes ?? null,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.domains) website.domains = (row.domains as any[]).map(mapWebsiteDomain);
  if (row.client) website.client = mapClient(row.client);
  return website;
}

export function mapWebsiteDomain(row: any): WebsiteDomain {
  return {
    id: row.id,
    websiteId: row.website_id,
    domain: row.domain,
    isPrimary: Boolean(row.is_primary),
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

export function mapInvoice(row: any): Invoice {
  const invoice: Invoice = {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id,
    websiteId: row.website_id ?? null,
    invoiceType: row.invoice_type,
    issueDate: row.issue_date,
    dueDate: row.due_date ?? null,
    subtotalPaise: Number(row.subtotal_paise ?? 0),
    taxPaise: Number(row.tax_paise ?? 0),
    totalPaise: Number(row.total_paise ?? 0),
    amountPaidPaise: Number(row.amount_paid_paise ?? 0),
    status: row.status,
    taxRatePercent: Number(row.tax_rate_percent ?? 0),
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.items) invoice.items = (row.items as any[]).map(mapInvoiceItem);
  if (row.client) invoice.client = mapClient(row.client);
  if (row.website) invoice.website = mapWebsite(row.website);
  return invoice;
}

export function mapInvoiceItem(row: any): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    description: row.description,
    quantity: Number(row.quantity ?? 1),
    unitPricePaise: Number(row.unit_price_paise ?? 0),
    amountPaise: Number(row.amount_paise ?? 0),
    taxRatePercent: Number(row.tax_rate_percent ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function mapPayment(row: any): Payment {
  const payment: Payment = {
    id: row.id,
    paymentCode: row.payment_code,
    clientId: row.client_id,
    websiteId: row.website_id ?? null,
    invoiceId: row.invoice_id ?? null,
    amountPaise: Number(row.amount_paise ?? 0),
    currency: row.currency ?? "INR",
    method: row.method,
    purpose: row.purpose,
    status: row.status,
    transactionRef: row.transaction_ref ?? null,
    razorpayOrderId: row.razorpay_order_id ?? null,
    razorpayPaymentId: row.razorpay_payment_id ?? null,
    paymentDate: row.payment_date ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.client) payment.client = mapClient(row.client);
  if (row.website) payment.website = mapWebsite(row.website);
  if (row.invoice) payment.invoice = mapInvoice(row.invoice);
  return payment;
}

export function mapRefund(row: any): Refund {
  return {
    id: row.id,
    refundCode: row.refund_code,
    paymentId: row.payment_id,
    invoiceId: row.invoice_id ?? null,
    amountPaise: Number(row.amount_paise ?? 0),
    reason: row.reason ?? null,
    status: row.status,
    razorpayRefundId: row.razorpay_refund_id ?? null,
    createdAt: row.created_at,
  };
}

export function mapAmcContract(row: any): AmcContract {
  return {
    id: row.id,
    websiteId: row.website_id,
    enabled: Boolean(row.enabled),
    exempt: Boolean(row.exempt),
    originalPricePaise: Number(row.original_price_paise ?? 0),
    renewalPricePaise: Number(row.renewal_price_paise ?? 0),
    negotiatedPricePaise: row.negotiated_price_paise === null ? null : Number(row.negotiated_price_paise),
    billingPeriodDays: Number(row.billing_period_days ?? 365),
    upcomingThresholdDays: Number(row.upcoming_threshold_days ?? 10),
    gracePeriodDays: Number(row.grace_period_days ?? 3),
    validityStart: row.validity_start ?? null,
    validityEnd: row.validity_end ?? null,
    lastRenewalDate: row.last_renewal_date ?? null,
    nextExpiryDate: row.next_expiry_date ?? null,
    status: row.status,
    accessStatus: row.access_status,
    suspensionReason: row.suspension_reason ?? null,
    suspendedAt: row.suspended_at ?? null,
    autoRenewal: Boolean(row.auto_renewal),
    razorpaySubscriptionId: row.razorpay_subscription_id ?? null,
    subscriptionStatus: row.subscription_status ?? null,
    mandateStatus: row.mandate_status ?? null,
    nextBillingDate: row.next_billing_date ?? null,
    cancellationDate: row.cancellation_date ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAmcPeriod(row: any): AmcPeriod {
  return {
    id: row.id,
    amcContractId: row.amc_contract_id,
    websiteId: row.website_id,
    startDate: row.start_date,
    endDate: row.end_date,
    pricePaise: Number(row.price_paise ?? 0),
    paymentId: row.payment_id ?? null,
    status: row.status,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

export function mapRenewalQuote(row: any): RenewalQuote {
  return {
    id: row.id,
    websiteId: row.website_id,
    amcContractId: row.amc_contract_id,
    amountPaise: Number(row.amount_paise ?? 0),
    originalAmountPaise: Number(row.original_amount_paise ?? 0),
    discountPaise: Number(row.discount_paise ?? 0),
    discountPercent: row.discount_percent === null ? null : Number(row.discount_percent),
    quoteType: row.quote_type,
    reason: row.reason ?? null,
    adminNotes: row.admin_notes ?? null,
    effectiveDate: row.effective_date,
    quoteExpiryDate: row.quote_expiry_date ?? null,
    status: row.status,
    razorpayOrderId: row.razorpay_order_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLicenseCredential(row: any): LicenseCredential {
  return {
    id: row.id,
    websiteId: row.website_id,
    websiteUuid: row.website_uuid,
    publicId: row.public_id,
    secretHash: row.secret_hash,
    secretPrefix: row.secret_prefix ?? null,
    isActive: Boolean(row.is_active),
    lastRotatedAt: row.last_rotated_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapActivityLog(row: any): ActivityLog {
  return {
    id: row.id,
    eventType: row.event_type,
    clientId: row.client_id ?? null,
    websiteId: row.website_id ?? null,
    actor: row.actor,
    description: row.description,
    previousValue: row.previous_value ?? null,
    newValue: row.new_value ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export function mapAdminNotification(row: any): AdminNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    severity: row.severity,
    relatedClientId: row.related_client_id ?? null,
    relatedWebsiteId: row.related_website_id ?? null,
    isRead: Boolean(row.is_read),
    dedupeKey: row.dedupe_key ?? null,
    createdAt: row.created_at,
  };
}

export function mapCronExecutionLog(row: any): CronExecutionLog {
  return {
    id: row.id,
    runId: row.run_id,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    websitesProcessed: Number(row.websites_processed ?? 0),
    upcomingCount: Number(row.upcoming_count ?? 0),
    expiredCount: Number(row.expired_count ?? 0),
    overdueCount: Number(row.overdue_count ?? 0),
    newlySuspended: Number(row.newly_suspended ?? 0),
    errors: Array.isArray(row.errors) ? row.errors : [],
    createdAt: row.created_at,
  };
}

export function mapNotificationTemplate(row: any): NotificationTemplate {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    subject: row.subject ?? null,
    body: row.body,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNotificationLog(row: any): NotificationLog {
  return {
    id: row.id,
    templateKey: row.template_key,
    websiteId: row.website_id ?? null,
    clientId: row.client_id ?? null,
    channel: row.channel,
    recipient: row.recipient ?? null,
    message: row.message ?? null,
    status: row.status,
    error: row.error ?? null,
    reminderInterval: row.reminder_interval ?? null,
    periodKey: row.period_key ?? null,
    createdAt: row.created_at,
  };
}

export function mapRazorpayOrder(row: any): RazorpayOrder {
  return {
    id: row.id,
    orderId: row.order_id,
    internalOrderRef: row.internal_order_ref,
    websiteId: row.website_id ?? null,
    clientId: row.client_id ?? null,
    paymentId: row.payment_id ?? null,
    quoteId: row.quote_id ?? null,
    amountPaise: Number(row.amount_paise ?? 0),
    currency: row.currency ?? "INR",
    status: row.status,
    receipt: row.receipt ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRazorpayWebhookEvent(row: any): RazorpayWebhookEvent {
  return {
    id: row.id,
    eventId: row.event_id,
    eventName: row.event_name,
    paymentId: row.payment_id ?? null,
    orderId: row.order_id ?? null,
    status: row.status,
    error: row.error ?? null,
    createdAt: row.created_at,
    processedAt: row.processed_at ?? null,
  };
}
