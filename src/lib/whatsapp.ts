import { config } from "@/lib/config";

/**
 * WhatsApp click-to-chat helpers.
 *
 * Uses the official wa.me link format. No unofficial API is used and messages
 * are never sent automatically.
 */

export interface WhatsAppContact {
  mobile?: string | null;
  whatsappNumber?: string | null;
}

export function normalizeMobile(raw: string | null | undefined, defaultCountryCode = "91"): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;

  // 10-digit local Indian number -> add country code
  if (digits.length === 10) {
    digits = `${defaultCountryCode}${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    // trunk-prefixed local number
    digits = `${defaultCountryCode}${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith("91") && digits[2] !== "0") {
    // already has country code
  } else if (digits.length > 10 && digits.length <= 15) {
    // assume country code present
  } else {
    return null;
  }

  if (digits.length < 11 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Strip the leading + for wa.me links (wa.me expects digits only). */
export function waNumber(raw: string | null | undefined, defaultCountryCode = "91"): string | null {
  const normalized = normalizeMobile(raw, defaultCountryCode);
  return normalized ? normalized.replace(/^\+/, "") : null;
}

export function buildWhatsAppLink(
  number: string | null | undefined,
  message: string,
  baseUrl: string = config.notifications.whatsappBaseUrl
): string | null {
  const num = waNumber(number);
  if (!num) return null;
  const text = encodeURIComponent(message);
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${num}?text=${text}`;
}

export type TemplateVariables = Record<string, string | number | null | undefined>;

/** Replace {variable} placeholders in a message template. */
export function interpolateTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = variables[key];
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  });
}

export interface WhatsAppTemplate {
  key: string;
  name: string;
  body: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    key: "reminder_30",
    name: "30-day renewal reminder",
    body: "Hello {client_name}, this is a friendly reminder that your website {website_name} annual maintenance renewal of {renewal_amount} is due on {expiry_date}. Please renew to keep your website active.",
  },
  {
    key: "reminder_15",
    name: "15-day renewal reminder",
    body: "Hello {client_name}, your website {website_name} maintenance renewal of {renewal_amount} is due in {days_remaining} days ({expiry_date}). Kindly complete the payment to avoid interruption.",
  },
  {
    key: "reminder_7",
    name: "7-day renewal reminder",
    body: "Hello {client_name}, only {days_remaining} days left for your website {website_name} renewal of {renewal_amount}. Please pay by {expiry_date} to keep your website running.",
  },
  {
    key: "expiry",
    name: "Expiry notification",
    body: "Hello {client_name}, your website {website_name} annual maintenance expired on {expiry_date}. Please renew {renewal_amount} to restore full access.",
  },
  {
    key: "grace_period",
    name: "Grace-period reminder",
    body: "Hello {client_name}, your website {website_name} is in the grace period. Renewal of {renewal_amount} is pending. Please pay now to avoid suspension.",
  },
  {
    key: "suspension",
    name: "Website suspension notification",
    body: "Hello {client_name}, your website {website_name} has been suspended due to an expired maintenance plan. Please renew {renewal_amount} to restore access immediately.",
  },
  {
    key: "renewal_success",
    name: "Successful renewal confirmation",
    body: "Hello {client_name}, thank you! Your website {website_name} maintenance has been renewed for {renewal_amount}. New validity: {expiry_date}.",
  },
  {
    key: "payment_reminder",
    name: "Payment reminder",
    body: "Hello {client_name}, this is a reminder that {renewal_amount} is pending for {website_name}. Please complete the payment at your earliest convenience.",
  },
];

export function templateVariablesFromContext(ctx: {
  clientName?: string | null;
  contactPerson?: string | null;
  websiteName?: string | null;
  domain?: string | null;
  mobile?: string | null;
  amcAmount?: string | null;
  renewalAmount?: string | null;
  expiryDate?: string | null;
  daysRemaining?: number | null;
  daysOverdue?: number | null;
  paymentLink?: string | null;
}): TemplateVariables {
  return {
    client_name: ctx.clientName ?? "",
    contact_person: ctx.contactPerson ?? "",
    website_name: ctx.websiteName ?? "",
    domain: ctx.domain ?? "",
    mobile: ctx.mobile ?? "",
    amc_amount: ctx.amcAmount ?? "",
    renewal_amount: ctx.renewalAmount ?? "",
    expiry_date: ctx.expiryDate ?? "",
    days_remaining: ctx.daysRemaining ?? "",
    days_overdue: ctx.daysOverdue ?? "",
    payment_link: ctx.paymentLink ?? "",
  };
}
