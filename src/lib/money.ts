/**
 * Money helpers.
 *
 * All amounts are stored and computed as integer paise (1 INR = 100 paise).
 * Never use floating point for financial arithmetic.
 */

export type Paise = number;

/** Convert a user-entered INR string/number to integer paise. */
export function toPaise(value: string | number | null | undefined): Paise {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
  }
  const cleaned = value.replace(/[₹,\s]/g, "").trim();
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Format integer paise as Indian Rupees with Indian digit grouping. */
export function formatINR(paise: number | null | undefined): string {
  const safe = Number.isFinite(paise as number) ? (paise as number) : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe / 100);
}

/** Format integer paise without currency symbol (e.g. "1,234.56"). */
export function formatAmount(paise: number | null | undefined): string {
  const safe = Number.isFinite(paise as number) ? (paise as number) : 0;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe / 100);
}

/** Convert paise to a plain number of rupees for charting (display only). */
export function paiseToRupees(paise: number): number {
  return Math.round((paise / 100) * 100) / 100;
}

/** Safe integer addition for paise values. */
export function addPaise(...values: number[]): number {
  return values.reduce((sum, v) => sum + Math.round(v), 0);
}

export function subtractPaise(a: number, b: number): number {
  return Math.round(a) - Math.round(b);
}

export function multiplyPaise(paise: number, factor: number): number {
  return Math.round(paise * factor);
}

/** Parse a paise amount back to rupees with 2 decimals. */
export function paiseToNumber(paise: number): number {
  return Math.round(paise) / 100;
}

export function isPositivePaise(paise: number): boolean {
  return Number.isInteger(paise) && paise > 0;
}
