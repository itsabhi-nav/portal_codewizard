import { describe, it, expect } from "vitest";
import { normalizeMobile, buildWhatsAppLink, interpolateTemplate, waNumber } from "@/lib/whatsapp";

describe("normalizeMobile", () => {
  it("normalizes 10-digit Indian numbers", () => {
    expect(normalizeMobile("9876543210")).toBe("+919876543210");
  });

  it("keeps existing country codes", () => {
    expect(normalizeMobile("+919876543210")).toBe("+919876543210");
    expect(normalizeMobile("919876543210")).toBe("+919876543210");
  });

  it("handles trunk-prefixed local numbers", () => {
    expect(normalizeMobile("09876543210")).toBe("+919876543210");
  });

  it("handles formatting characters", () => {
    expect(normalizeMobile("+91 98765 43210")).toBe("+919876543210");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeMobile("")).toBeNull();
    expect(normalizeMobile("123")).toBeNull();
    expect(normalizeMobile(null)).toBeNull();
  });
});

describe("waNumber", () => {
  it("strips the leading +", () => {
    expect(waNumber("+919876543210")).toBe("919876543210");
    expect(waNumber("9876543210")).toBe("919876543210");
  });
});

describe("buildWhatsAppLink", () => {
  it("builds a wa.me link with an encoded message", () => {
    const link = buildWhatsAppLink("9876543210", "Hello there", "https://wa.me/");
    expect(link).toBe("https://wa.me/919876543210?text=Hello%20there");
  });

  it("returns null when no valid number exists", () => {
    expect(buildWhatsAppLink(null, "Hello")).toBeNull();
    expect(buildWhatsAppLink("123", "Hello")).toBeNull();
  });
});

describe("interpolateTemplate", () => {
  it("replaces known variables", () => {
    const template = "Hello {client_name}, your website {website_name} renews for {renewal_amount}.";
    const result = interpolateTemplate(template, {
      client_name: "Acme",
      website_name: "Acme Site",
      renewal_amount: "₹3,000",
    });
    expect(result).toBe("Hello Acme, your website Acme Site renews for ₹3,000.");
  });

  it("removes unknown/empty variables", () => {
    expect(interpolateTemplate("Hi {client_name} {missing}", { client_name: "Acme" })).toBe("Hi Acme ");
  });
});
