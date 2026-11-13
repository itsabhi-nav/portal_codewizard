import { z } from "zod";
import { toPaise } from "@/lib/money";

/** Accept a rupee string/number and normalize to integer paise. */
const paiseField = (required = false) => {
  const base = z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((value) => {
      if (value === null || value === undefined || value === "") return required ? null : 0;
      return toPaise(value);
    });
  return base;
};

/**
 * For UPDATE payloads: a missing/empty value must mean "leave it unchanged",
 * never "set it to 0". (z.transform always runs, even when the key is absent,
 * so the default must be `undefined` — PATCH skips undefined keys.)
 */
const updatePaiseField = () =>
  z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((value) => {
      if (value === null || value === undefined || value === "") return undefined;
      return toPaise(value);
    });

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .optional()
  .nullable();

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(200),
  businessName: z.string().trim().max(200).optional().nullable(),
  contactPerson: z.string().trim().max(200).optional().nullable(),
  mobile: z.string().trim().max(20).optional().nullable(),
  whatsappNumber: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email("Invalid email address").optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  pinCode: z.string().trim().max(10).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export const websiteCreateSchema = z.object({
  clientId: z.string().uuid("A valid client is required"),
  name: z.string().trim().min(1, "Website name is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  domain: z.string().trim().max(255).optional().nullable(),
  projectStartDate: dateField,
  goLiveDate: dateField,
  developmentCost: paiseField(),
  domainCharge: paiseField(),
  hostingCharge: paiseField(),
  domainChargeFrequency: z.enum(["one_time", "annual"]).optional().default("annual"),
  hostingChargeFrequency: z.enum(["one_time", "annual"]).optional().default("annual"),
  amcAmount: paiseField(),
  status: z.enum(["development", "testing", "live", "suspended", "archived"]).optional(),
  hostingProvider: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const websiteUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  projectStartDate: dateField,
  goLiveDate: dateField,
  developmentCost: updatePaiseField(),
  domainCharge: updatePaiseField(),
  hostingCharge: updatePaiseField(),
  domainChargeFrequency: z.enum(["one_time", "annual"]).optional(),
  hostingChargeFrequency: z.enum(["one_time", "annual"]).optional(),
  amcAmount: updatePaiseField(),
  status: z.enum(["development", "testing", "live", "suspended", "archived"]).optional(),
  hostingProvider: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const domainUpdateSchema = z.object({
  domain: z.string().trim().min(1).max(255),
  isPrimary: z.boolean().optional().default(true),
  reason: z.string().trim().max(500).optional(),
});

export const paymentCreateSchema = z.object({
  clientId: z.string().uuid(),
  websiteId: z.string().uuid().optional().nullable(),
  invoiceId: z.string().uuid().optional().nullable(),
  amount: paiseField(),
  method: z.enum(["razorpay", "upi", "bank_transfer", "cash", "other"]),
  purpose: z.enum([
    "advance",
    "domain",
    "amc_hosting",
    "final_completion",
    "development",
    "amc_renewal",
    "additional_development",
    "hosting",
    "other",
  ]),
  status: z
    .enum(["created", "pending", "successful", "failed", "refunded", "partially_refunded"])
    .optional()
    .default("successful"),
  transactionRef: z.string().trim().max(200).optional().nullable(),
  paymentDate: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const paymentUpdateSchema = z.object({
  status: z
    .enum(["created", "pending", "successful", "failed", "refunded", "partially_refunded"])
    .optional(),
  transactionRef: z.string().trim().max(200).optional().nullable(),
  paymentDate: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const refundCreateSchema = z.object({
  amount: paiseField(),
  reason: z.string().trim().max(1000).optional().nullable(),
  processViaRazorpay: z.boolean().optional().default(false),
});

export const invoiceCreateSchema = z.object({
  clientId: z.string().uuid(),
  websiteId: z.string().uuid().optional().nullable(),
  invoiceType: z
    .enum(["development", "amc", "additional_service", "hosting", "other"])
    .default("development"),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: dateField,
  taxRatePercent: z.number().min(0).max(100).optional().default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(500),
        quantity: z.number().positive().default(1),
        unitPrice: paiseField(),
        taxRatePercent: z.number().min(0).max(100).optional().default(0),
      })
    )
    .min(1, "At least one line item is required"),
});

export const invoiceUpdateSchema = z.object({
  status: z.enum(["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"]).optional(),
  dueDate: dateField,
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const amcConfigureSchema = z.object({
  enabled: z.boolean().optional(),
  exempt: z.boolean().optional(),
  originalPrice: paiseField(),
  renewalPrice: paiseField(),
  negotiatedPrice: paiseField(),
  billingPeriodDays: z.number().int().positive().optional(),
  upcomingThresholdDays: z.number().int().min(0).optional(),
  gracePeriodDays: z.number().int().min(0).optional(),
  validityStart: dateField,
  validityEnd: dateField,
  autoRenewal: z.boolean().optional(),
});

export const amcExtendSchema = z.object({
  newValidityEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(500).optional(),
});

export const amcSuspendSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const quoteCreateSchema = z.object({
  amount: paiseField(),
  quoteType: z.enum(["one_time_discount", "permanent_price_change", "manual"]).default("one_time_discount"),
  reason: z.string().trim().max(500).optional().nullable(),
  adminNotes: z.string().trim().max(1000).optional().nullable(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  quoteExpiryDate: dateField,
  permanentNewAnnualPrice: paiseField(),
});

export const manualRenewSchema = z.object({
  amount: paiseField(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethod: z.enum(["razorpay", "upi", "bank_transfer", "cash", "other"]).default("other"),
  transactionRef: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const settingsUpdateSchema = z.object({
  general: z
    .object({
      agencyName: z.string().max(200).optional(),
      logoUrl: z.string().max(500).optional(),
      supportEmail: z.string().max(200).optional(),
      supportPhone: z.string().max(20).optional(),
      websiteUrl: z.string().max(500).optional(),
      currency: z.string().max(10).optional(),
      timezone: z.string().max(50).optional(),
      invoicePrefix: z.string().max(20).optional(),
      defaultTheme: z.enum(["light", "dark", "system"]).optional(),
    })
    .optional(),
  amc: z
    .object({
      defaultAmountPaise: z.number().int().min(0).optional(),
      defaultBillingPeriodDays: z.number().int().positive().optional(),
      upcomingThresholdDays: z.number().int().min(0).optional(),
      gracePeriodDays: z.number().int().min(0).optional(),
      reminderIntervals: z.array(z.number().int().min(0)).optional(),
      autoSuspend: z.boolean().optional(),
      autoRemind: z.boolean().optional(),
    })
    .optional(),
  renewalScreen: z
    .object({
      heading: z.string().max(300).optional(),
      description: z.string().max(2000).optional(),
      buttonText: z.string().max(100).optional(),
      supportText: z.string().max(1000).optional(),
      logoUrl: z.string().max(500).optional(),
      background: z.string().max(20).optional(),
      textColor: z.string().max(20).optional(),
      buttonColor: z.string().max(20).optional(),
      showSupport: z.boolean().optional(),
      supportEmail: z.string().max(200).optional(),
      supportPhone: z.string().max(20).optional(),
    })
    .optional(),
  whatsapp: z
    .object({
      defaultCountryCode: z.string().max(5).optional(),
      defaultMessage: z.string().max(2000).optional(),
      reminderIntervals: z.array(z.number().int().min(0)).optional(),
    })
    .optional(),
  payments: z
    .object({
      razorpayEnabled: z.boolean().optional(),
      methods: z.array(z.string()).optional(),
      taxEnabled: z.boolean().optional(),
      taxRatePercent: z.number().min(0).max(100).optional(),
      taxLabel: z.string().max(100).optional(),
      invoiceNotes: z.string().max(2000).optional(),
    })
    .optional(),
});

export const templateUpdateSchema = z.object({
  key: z.string().min(1),
  name: z.string().max(200).optional(),
  body: z.string().max(4000).optional(),
  isActive: z.boolean().optional(),
});
