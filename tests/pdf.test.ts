import { describe, expect, it } from "vitest";
import { generateInvoicePdf } from "@/lib/pdf";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings";
import type { Client, Invoice, InvoiceItem, Website } from "@/lib/types";

const client: Client = {
  id: "client-1",
  clientCode: "CLI-00001",
  name: "Example Client",
  businessName: "Example Business",
  contactPerson: "A. Person",
  mobile: "+919876543210",
  whatsappNumber: null,
  email: "client@example.com",
  address: "12 Example Road",
  city: "Mumbai",
  state: "Maharashtra",
  pinCode: "400001",
  notes: null,
  archived: false,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const website: Website = {
  id: "website-1",
  publicId: "cw_abcdefghij",
  clientId: client.id,
  name: "Example Website",
  description: null,
  projectStartDate: null,
  goLiveDate: null,
  developmentCostPaise: 100_000,
  domainChargePaise: 0,
  hostingChargePaise: 0,
  domainChargeFrequency: "annual",
  hostingChargeFrequency: "annual",
  status: "live",
  hostingProvider: null,
  notes: null,
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  domains: [],
};

function makeInvoice(items: InvoiceItem[]): Invoice {
  const subtotalPaise = items.reduce((sum, item) => sum + item.amountPaise, 0);
  const taxPaise = Math.round(subtotalPaise * 0.18);
  return {
    id: "invoice-1",
    invoiceNumber: "INV-2026-0001",
    clientId: client.id,
    websiteId: website.id,
    invoiceType: "development",
    issueDate: "2026-11-14",
    dueDate: "2026-11-28",
    subtotalPaise,
    taxPaise,
    totalPaise: subtotalPaise + taxPaise,
    amountPaidPaise: 0,
    status: "sent",
    taxRatePercent: 18,
    notes: "Thank you for choosing our services.",
    createdAt: "2026-11-14T00:00:00.000Z",
    updatedAt: "2026-11-14T00:00:00.000Z",
    items,
  };
}

function makeItem(index: number, description: string): InvoiceItem {
  return {
    id: `item-${index}`,
    invoiceId: "invoice-1",
    description,
    quantity: 1,
    unitPricePaise: 10_000,
    amountPaise: 10_000,
    taxRatePercent: 0,
    sortOrder: index,
  };
}

function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
}

describe("invoice PDF", () => {
  it("generates a valid one-page invoice with tax and payment summaries", async () => {
    const pdf = await generateInvoicePdf(
      makeInvoice([makeItem(0, "Website design and development")]),
      client,
      website,
      DEFAULT_APP_SETTINGS
    );

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
  });

  it("moves long item lists onto additional pages instead of clipping them", async () => {
    const items = Array.from({ length: 60 }, (_, index) =>
      makeItem(index, `Website design, development, implementation, and support service ${index + 1}`)
    );
    const pdf = await generateInvoicePdf(makeInvoice(items), client, website, DEFAULT_APP_SETTINGS);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBeGreaterThan(1);
  });
});
