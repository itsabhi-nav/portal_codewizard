import { describe, it, expect } from "vitest";
import { toPaise, formatINR, paiseToRupees, addPaise, subtractPaise } from "@/lib/money";

describe("toPaise", () => {
  it("converts rupee strings to integer paise", () => {
    expect(toPaise("1")).toBe(100);
    expect(toPaise("10.50")).toBe(1050);
    expect(toPaise("₹1,234.56")).toBe(123456);
    expect(toPaise("0")).toBe(0);
  });

  it("handles numbers", () => {
    expect(toPaise(500)).toBe(50000);
    expect(toPaise(99.99)).toBe(9999);
  });

  it("handles empty and invalid input", () => {
    expect(toPaise("")).toBe(0);
    expect(toPaise(null)).toBe(0);
    expect(toPaise(undefined)).toBe(0);
    expect(toPaise("abc")).toBe(0);
  });
});

describe("formatINR", () => {
  it("formats paise as Indian Rupees", () => {
    expect(formatINR(123456)).toBe("₹1,234.56");
    expect(formatINR(0)).toBe("₹0.00");
    expect(formatINR(100000)).toBe("₹1,000.00");
  });
});

describe("paiseToRupees", () => {
  it("converts paise to rupees for charting", () => {
    expect(paiseToRupees(123456)).toBe(1234.56);
    expect(paiseToRupees(50)).toBe(0.5);
  });
});

describe("safe arithmetic", () => {
  it("adds paise as integers", () => {
    expect(addPaise(10, 20, 30)).toBe(60);
    expect(addPaise(99, 1)).toBe(100);
    expect(subtractPaise(100, 30)).toBe(70);
  });
});
