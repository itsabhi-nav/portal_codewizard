import { addDays, daysBetween } from "@/lib/dates";

/**
 * AMC business logic — pure, testable functions.
 *
 * Business status vs access status:
 * - `businessStatus` (active/upcoming/expired/overdue/suspended/exempt/disabled)
 *   describes the AMC contract lifecycle.
 * - `accessStatus` (active/suspended/manual_suspended/archived) is the
 *   enforcement state used by the license engine. Manual suspension is kept
 *   separate from automatic AMC suspension.
 */

export type AmcBusinessStatus =
  | "active"
  | "upcoming"
  | "expired"
  | "overdue"
  | "suspended"
  | "exempt"
  | "disabled";

export type AccessStatus = "active" | "suspended" | "manual_suspended" | "archived";

export interface AmcStatusInput {
  enabled: boolean;
  exempt: boolean;
  validityEnd: string | null; // YYYY-MM-DD
  businessDate: string; // YYYY-MM-DD
  upcomingThresholdDays: number;
  gracePeriodDays: number;
}

export interface AmcStatusResult {
  status: AmcBusinessStatus;
  /** Days of validity remaining relative to the business date. Negative = overdue. */
  daysRemaining: number | null;
  /** Positive number of days past validity end. */
  daysOverdue: number;
  isExpired: boolean;
  /** True when the grace period has fully elapsed. */
  isGraceEnded: boolean;
  reason?: string;
}

/**
 * Validity boundary:
 * - validity_start is included
 * - validity_end is the final valid date
 * - expiry begins on the following calendar date
 */
export function computeAmcStatus(input: AmcStatusInput): AmcStatusResult {
  const { enabled, exempt, validityEnd, businessDate, upcomingThresholdDays, gracePeriodDays } = input;

  if (!enabled) {
    return { status: "disabled", daysRemaining: null, daysOverdue: 0, isExpired: false, isGraceEnded: false, reason: "AMC disabled" };
  }
  if (exempt) {
    return { status: "exempt", daysRemaining: null, daysOverdue: 0, isExpired: false, isGraceEnded: false, reason: "Exempt from AMC" };
  }
  if (!validityEnd) {
    return { status: "disabled", daysRemaining: null, daysOverdue: 0, isExpired: false, isGraceEnded: false, reason: "No validity period configured" };
  }

  const daysRemaining = daysBetween(validityEnd, businessDate);

  if (daysRemaining >= 0) {
    // Still within the validity window (validity_end inclusive).
    const status: AmcBusinessStatus = daysRemaining <= upcomingThresholdDays ? "upcoming" : "active";
    return { status, daysRemaining, daysOverdue: 0, isExpired: false, isGraceEnded: false };
  }

  const daysOverdue = -daysRemaining;
  const isGraceEnded = daysOverdue > gracePeriodDays;
  return {
    status: isGraceEnded ? "suspended" : "overdue",
    daysRemaining,
    daysOverdue,
    isExpired: true,
    isGraceEnded,
  };
}

export interface RenewalPeriodInput {
  /** Current validity end date, if any. */
  currentValidityEnd: string | null;
  /** Business date on which the renewal is processed. */
  businessDate: string;
  /** Agreed renewal effective date (used when renewing after expiry). */
  effectiveDate: string;
  billingPeriodDays: number;
}

export interface RenewalPeriod {
  startDate: string;
  endDate: string;
  /** True when the renewal extends the existing active period. */
  extendedExisting: boolean;
}

/**
 * Renewal logic:
 * - Renew before (or on) the existing validity end -> start from end + 1 day.
 * - Renew after expiry -> start from the agreed renewal effective date.
 * - New end = start + billingPeriodDays - 1 (both dates inclusive).
 */
export function computeRenewalPeriod(input: RenewalPeriodInput): RenewalPeriod {
  const { currentValidityEnd, businessDate, effectiveDate, billingPeriodDays } = input;

  let startDate: string;
  let extendedExisting = false;

  if (currentValidityEnd && businessDate <= currentValidityEnd) {
    startDate = addDays(currentValidityEnd, 1);
    extendedExisting = true;
  } else {
    startDate = effectiveDate;
  }

  const period = Math.max(1, Math.round(billingPeriodDays));
  const endDate = addDays(startDate, period - 1);

  return { startDate, endDate, extendedExisting };
}

export interface QuoteAmountInput {
  renewalPricePaise: number;
  negotiatedPricePaise: number | null;
  negotiatedPriceExpiry: string | null;
  businessDate: string;
}

/** Authoritative amount for a renewal quote. */
export function computeQuoteAmount(input: QuoteAmountInput): {
  amountPaise: number;
  originalAmountPaise: number;
  discountPaise: number;
  discountPercent: number | null;
  source: "negotiated" | "default";
} {
  const { renewalPricePaise, negotiatedPricePaise, negotiatedPriceExpiry, businessDate } = input;
  const original = Math.max(0, Math.round(renewalPricePaise));

  const negotiatedActive =
    negotiatedPricePaise !== null &&
    negotiatedPricePaise >= 0 &&
    (!negotiatedPriceExpiry || negotiatedPriceExpiry >= businessDate);

  if (negotiatedActive && negotiatedPricePaise !== null) {
    const amount = Math.round(negotiatedPricePaise);
    const discount = Math.max(0, original - amount);
    return {
      amountPaise: amount,
      originalAmountPaise: original,
      discountPaise: discount,
      discountPercent: original > 0 ? Math.round((discount / original) * 10000) / 100 : null,
      source: "negotiated",
    };
  }

  return {
    amountPaise: original,
    originalAmountPaise: original,
    discountPaise: 0,
    discountPercent: null,
    source: "default",
  };
}

export const AMC_STATUS_LABELS: Record<AmcBusinessStatus, string> = {
  active: "Active",
  upcoming: "Upcoming",
  expired: "Expired",
  overdue: "Overdue",
  suspended: "Suspended",
  exempt: "Exempt",
  disabled: "Disabled",
};

export const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  active: "Active",
  suspended: "AMC Suspended",
  manual_suspended: "Manually Suspended",
  archived: "Archived",
};
