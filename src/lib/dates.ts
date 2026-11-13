import { config } from "@/lib/config";

export const BUSINESS_TIMEZONE = config.timezone || "Asia/Kolkata";

const MS_PER_DAY = 86_400_000;

/** Format a Date as YYYY-MM-DD in the configured business timezone. */
export function toISODateInTimezone(date: Date, timeZone: string = BUSINESS_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/** Current business date (Asia/Kolkata by default) as YYYY-MM-DD. */
export function todayIST(): string {
  return toISODateInTimezone(new Date(), BUSINESS_TIMEZONE);
}

/** Parse YYYY-MM-DD into a UTC-midnight Date (safe for arithmetic). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

/** Add days to a YYYY-MM-DD string. */
export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD strings (a - b). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / MS_PER_DAY);
}

/** Format a date as e.g. "10 Nov 2026" in the business timezone. */
export function formatDateIST(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? parseISODate(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Format a timestamp as "10 Nov 2026, 02:30 PM" in the business timezone. */
export function formatDateTimeIST(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Relative label such as "in 12 days" or "5 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  if (days > 1) return `in ${days} days`;
  const over = Math.abs(days);
  return over === 1 ? "1 day ago" : `${over} days ago`;
}

/** Current year-month in business timezone, used for reminder dedup. */
export function currentPeriodKey(): string {
  const now = new Date();
  const iso = toISODateInTimezone(now);
  return iso.slice(0, 7);
}
