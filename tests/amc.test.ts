import { describe, it, expect } from "vitest";
import { computeAmcStatus, computeRenewalPeriod, computeQuoteAmount } from "@/lib/amc";

const base = {
  enabled: true,
  exempt: false,
  upcomingThresholdDays: 10,
  gracePeriodDays: 3,
};

describe("computeAmcStatus", () => {
  it("returns active when more than the threshold remains", () => {
    const result = computeAmcStatus({ ...base, validityEnd: "2026-06-01", businessDate: "2026-05-01" });
    expect(result.status).toBe("active");
    expect(result.daysRemaining).toBe(31);
    expect(result.isExpired).toBe(false);
  });

  it("returns upcoming when remaining days are within the threshold", () => {
    const result = computeAmcStatus({ ...base, validityEnd: "2026-05-11", businessDate: "2026-05-01" });
    expect(result.status).toBe("upcoming");
    expect(result.daysRemaining).toBe(10);
  });

  it("treats the validity end date as the final valid day", () => {
    const result = computeAmcStatus({ ...base, validityEnd: "2026-05-01", businessDate: "2026-05-01" });
    expect(result.status).toBe("upcoming");
    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });

  it("returns overdue the day after validity ends (within grace)", () => {
    const result = computeAmcStatus({ ...base, validityEnd: "2026-05-01", businessDate: "2026-05-02" });
    expect(result.status).toBe("overdue");
    expect(result.isExpired).toBe(true);
    expect(result.daysOverdue).toBe(1);
  });

  it("returns suspended after the grace period elapses", () => {
    const result = computeAmcStatus({ ...base, validityEnd: "2026-05-01", businessDate: "2026-05-06" });
    expect(result.status).toBe("suspended");
    expect(result.daysOverdue).toBe(5);
    expect(result.isGraceEnded).toBe(true);
  });

  it("respects a custom grace period", () => {
    const result = computeAmcStatus({
      ...base,
      gracePeriodDays: 7,
      validityEnd: "2026-05-01",
      businessDate: "2026-05-06",
    });
    expect(result.status).toBe("overdue");
  });

  it("returns exempt when exempted", () => {
    const result = computeAmcStatus({ ...base, exempt: true, validityEnd: "2020-01-01", businessDate: "2026-05-01" });
    expect(result.status).toBe("exempt");
  });

  it("returns disabled when AMC is disabled", () => {
    const result = computeAmcStatus({ ...base, enabled: false, validityEnd: "2026-05-01", businessDate: "2026-05-01" });
    expect(result.status).toBe("disabled");
  });

  it("returns disabled when no validity period exists", () => {
    const result = computeAmcStatus({ ...base, validityEnd: null, businessDate: "2026-05-01" });
    expect(result.status).toBe("disabled");
    expect(result.reason).toContain("No validity period");
  });

  it("handles leap years correctly", () => {
    // 2024-02-29 is the final valid day; 2024-03-01 is one day overdue.
    const lastDay = computeAmcStatus({ ...base, validityEnd: "2024-02-29", businessDate: "2024-02-29" });
    expect(lastDay.status).toBe("upcoming");

    const nextDay = computeAmcStatus({ ...base, validityEnd: "2024-02-29", businessDate: "2024-03-01" });
    expect(nextDay.status).toBe("overdue");
    expect(nextDay.daysOverdue).toBe(1);
  });

  it("handles month boundaries correctly", () => {
    const result = computeAmcStatus({ ...base, validityEnd: "2026-01-31", businessDate: "2026-02-01" });
    expect(result.status).toBe("overdue");
    expect(result.daysOverdue).toBe(1);
  });

  it("uses the supplied business date (IST semantics)", () => {
    const result = computeAmcStatus({ ...base, validityEnd: "2026-12-31", businessDate: "2026-01-01" });
    expect(result.daysRemaining).toBe(364);
  });
});

describe("computeRenewalPeriod", () => {
  it("extends from the existing validity end when renewing early", () => {
    const period = computeRenewalPeriod({
      currentValidityEnd: "2026-05-01",
      businessDate: "2026-04-20",
      effectiveDate: "2026-04-20",
      billingPeriodDays: 365,
    });
    expect(period.startDate).toBe("2026-05-02");
    expect(period.endDate).toBe("2027-05-01");
    expect(period.extendedExisting).toBe(true);
  });

  it("allows renewal on the final valid day as an early renewal", () => {
    const period = computeRenewalPeriod({
      currentValidityEnd: "2026-05-01",
      businessDate: "2026-05-01",
      effectiveDate: "2026-05-01",
      billingPeriodDays: 365,
    });
    expect(period.startDate).toBe("2026-05-02");
    expect(period.extendedExisting).toBe(true);
  });

  it("starts from the effective date when renewing after expiry", () => {
    const period = computeRenewalPeriod({
      currentValidityEnd: "2026-05-01",
      businessDate: "2026-05-10",
      effectiveDate: "2026-05-10",
      billingPeriodDays: 365,
    });
    expect(period.startDate).toBe("2026-05-10");
    expect(period.endDate).toBe("2027-05-09");
    expect(period.extendedExisting).toBe(false);
  });

  it("handles a missing current validity end", () => {
    const period = computeRenewalPeriod({
      currentValidityEnd: null,
      businessDate: "2026-05-10",
      effectiveDate: "2026-05-10",
      billingPeriodDays: 365,
    });
    expect(period.startDate).toBe("2026-05-10");
    expect(period.endDate).toBe("2027-05-09");
  });

  it("supports custom billing periods", () => {
    const period = computeRenewalPeriod({
      currentValidityEnd: null,
      businessDate: "2026-01-01",
      effectiveDate: "2026-01-01",
      billingPeriodDays: 30,
    });
    expect(period.startDate).toBe("2026-01-01");
    expect(period.endDate).toBe("2026-01-30");
  });

  it("handles leap-year billing periods", () => {
    const period = computeRenewalPeriod({
      currentValidityEnd: null,
      businessDate: "2024-02-01",
      effectiveDate: "2024-02-01",
      billingPeriodDays: 365,
    });
    expect(period.startDate).toBe("2024-02-01");
    // 2024-02-01 + 364 days = 2025-01-30 (365-day inclusive period).
    expect(period.endDate).toBe("2025-01-30");
  });
});

describe("computeQuoteAmount", () => {
  it("uses the negotiated price when active", () => {
    const result = computeQuoteAmount({
      renewalPricePaise: 300000,
      negotiatedPricePaise: 200000,
      negotiatedPriceExpiry: "2026-12-31",
      businessDate: "2026-06-01",
    });
    expect(result.amountPaise).toBe(200000);
    expect(result.discountPaise).toBe(100000);
    expect(result.discountPercent).toBeCloseTo(33.33, 1);
    expect(result.source).toBe("negotiated");
  });

  it("falls back to the default price when the negotiated quote expires", () => {
    const result = computeQuoteAmount({
      renewalPricePaise: 300000,
      negotiatedPricePaise: 200000,
      negotiatedPriceExpiry: "2026-01-01",
      businessDate: "2026-06-01",
    });
    expect(result.amountPaise).toBe(300000);
    expect(result.source).toBe("default");
  });

  it("uses the default price when no negotiated price exists", () => {
    const result = computeQuoteAmount({
      renewalPricePaise: 300000,
      negotiatedPricePaise: null,
      negotiatedPriceExpiry: null,
      businessDate: "2026-06-01",
    });
    expect(result.amountPaise).toBe(300000);
    expect(result.discountPaise).toBe(0);
  });

  it("does not produce a discount when negotiated equals renewal", () => {
    const result = computeQuoteAmount({
      renewalPricePaise: 300000,
      negotiatedPricePaise: 300000,
      negotiatedPriceExpiry: "2026-12-31",
      businessDate: "2026-06-01",
    });
    expect(result.amountPaise).toBe(300000);
    expect(result.discountPaise).toBe(0);
  });
});
