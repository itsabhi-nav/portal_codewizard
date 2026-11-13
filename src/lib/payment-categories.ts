/**
 * Simplified payment purposes used by the "Record Payment" flow.
 * Legacy values are kept so old records still display/validate.
 */
export const PAYMENT_PURPOSES = [
  "advance",
  "domain",
  "amc_hosting",
  "final_completion",
  // legacy (still accepted, not offered in the UI)
  "development",
  "amc_renewal",
  "additional_development",
  "hosting",
  "other",
] as const;

export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  advance: "Advance",
  domain: "Domain Charge",
  amc_hosting: "AMC & Hosting Charge",
  final_completion: "Final Completion Payment",
  development: "Development",
  amc_renewal: "AMC Renewal",
  additional_development: "Additional Development",
  hosting: "Hosting",
  other: "Other",
};

/** Invoice created automatically for a successful payment of this purpose. */
type ReceiptInvoiceType = "development" | "amc" | "additional_service" | "hosting" | "other";
export const PURPOSE_INVOICE: Record<string, { type: ReceiptInvoiceType; label: string }> = {
  advance: { type: "development", label: "Advance payment" },
  domain: { type: "other", label: "Domain charge" },
  amc_hosting: { type: "amc", label: "AMC & Hosting charge" },
  final_completion: { type: "additional_service", label: "Final completion payment" },
  development: { type: "development", label: "Development payment" },
  amc_renewal: { type: "amc", label: "AMC renewal payment" },
  additional_development: { type: "additional_service", label: "Additional development payment" },
  hosting: { type: "hosting", label: "Hosting payment" },
  other: { type: "other", label: "Payment" },
};

/** Purposes offered in the "Record Payment" dialog, in display order. */
export const PAYMENT_CATEGORY_CHOICES = [
  { value: "advance", label: "Advance" },
  { value: "domain", label: "Domain Charge" },
  { value: "amc_hosting", label: "AMC & Hosting Charge" },
  { value: "final_completion", label: "Final Completion Payment" },
] as const;
