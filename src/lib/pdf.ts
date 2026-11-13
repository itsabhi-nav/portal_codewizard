import PDFDocument from "pdfkit";
import type { Client, Invoice, Payment, Website } from "@/lib/types";
import type { AppSettings } from "@/lib/settings";
import { formatINR } from "@/lib/money";
import { formatDateIST } from "@/lib/dates";

/**
 * Branded, single-page PDF invoices and receipts.
 * pdfkit with built-in Helvetica (no external font files needed).
 */

const NAVY = "#0b1220";
const ACCENT = "#2563eb";
const ACCENT_SOFT = "#e0ecff";
const MUTED = "#64748b";
const ROWS = ["#ffffff", "#f8fafc"];

type PdfDocumentWithTable = PDFKit.PDFDocument;

/** Convert an amount to the Indian numbering system (lakh/crore). */
function amountToWords(amount: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return tens[t] + (o ? " " + ones[o] : "");
  }

  function threeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const parts: string[] = [];
    if (h) parts.push(`${ones[h]} Hundred`);
    if (rest) parts.push(twoDigits(rest));
    return parts.join(" ");
  }

  if (amount <= 0) return "Zero";
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const rest = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));

  let result = "INR " + (parts.length ? parts.join(" ") : "Zero");
  if (paise) result += ` and ${twoDigits(paise)} Paise`;
  return result + " Only";
}

function drawHeader(doc: PdfDocumentWithTable, settings: AppSettings, title: string, subtitle: string) {
  // Deep navy header with brand + company info
  doc.rect(0, 0, doc.page.width, 108).fill(NAVY);

  // Brand block
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text(settings.general.agencyName || "CodeWizard", 50, 26);
  doc.font("Helvetica").fontSize(8).fillColor("#7dd3fc").text("AGENCY MANAGEMENT", 50, 52);

  // Right-aligned company info
  doc.fillColor("#cbd5e1").fontSize(8).font("Helvetica");
  if (settings.general.websiteUrl) doc.text(settings.general.websiteUrl, 330, 26, { width: 220, align: "right" });
  if (settings.general.supportEmail) doc.text(settings.general.supportEmail, 330, 40, { width: 220, align: "right" });
  if (settings.general.supportPhone) doc.text(settings.general.supportPhone, 330, 54, { width: 220, align: "right" });

  // Electric blue accent divider
  doc.rect(0, 108, doc.page.width, 4).fill(ACCENT);

  // Title strip
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(15).text(title, 50, 124);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(subtitle, 50, 144);
}

function drawInfoBox(doc: PdfDocumentWithTable, x: number, y: number, width: number, title: string, lines: string[]) {
  doc.fillColor(ACCENT_SOFT).rect(x, y, width, 18).fill();
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(7.5).text(title.toUpperCase(), x + 6, y + 5);
  doc.fillColor("#1e293b").font("Helvetica").fontSize(8.5);
  let yy = y + 24;
  for (const line of lines) {
    doc.text(line, x + 6, yy, { width: width - 12 });
    yy += 13;
  }
}

function drawTable(doc: PdfDocumentWithTable, invoice: Invoice, settings: AppSettings, startY: number) {
  const left = 50;
  const width = doc.page.width - 100;
  const cols = [
    { label: "#", w: 24 },
    { label: "DESCRIPTION", w: width - 24 - 42 - 72 - 88 },
    { label: "QTY", w: 42 },
    { label: "UNIT PRICE", w: 88 },
    { label: "AMOUNT", w: 72 },
  ];

  // Header row
  doc.fillColor(NAVY).rect(left, startY, width, 22).fill();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5);
  let x = left;
  for (const col of cols) {
    doc.text(col.label, x + 6, startY + 8, { width: col.w - 12, align: col.label === "#" || col.label === "QTY" ? "center" : col.label === "DESCRIPTION" ? "left" : "right" });
    x += col.w;
  }

  // Body rows
  let y = startY + 22;
  let rowIndex = 0;
  for (const item of invoice.items ?? []) {
    const rowHeight = 26;
    doc.fillColor(ROWS[rowIndex % 2]).rect(left, y, width, rowHeight).fill();
    doc.fillColor("#1e293b").font("Helvetica").fontSize(8);

    x = left;
    doc.text(String(rowIndex + 1), x + 6, y + 9, { width: cols[0].w - 12, align: "center" });
    x += cols[0].w;
    doc.text(item.description, x + 6, y + 9, { width: cols[1].w - 12 });
    x += cols[1].w;
    doc.text(String(item.quantity), x + 6, y + 9, { width: cols[2].w - 12, align: "center" });
    x += cols[2].w;
    doc.text(formatINR(item.unitPricePaise), x + 6, y + 9, { width: cols[3].w - 12, align: "right" });
    x += cols[3].w;
    doc.text(formatINR(item.amountPaise), x + 6, y + 9, { width: cols[4].w - 12, align: "right" });

    y += rowHeight;
    rowIndex += 1;
  }

  // Bottom border
  doc.moveTo(left, y).lineTo(left + width, y).strokeColor(ACCENT).lineWidth(1.5).stroke();
  return y;
}

function drawTotals(doc: PdfDocumentWithTable, invoice: Invoice, settings: AppSettings, tableBottom: number) {
  const rightX = doc.page.width - 50;
  const boxWidth = 220;
  const startX = rightX - boxWidth;
  let y = tableBottom + 18;

  const rows: { label: string; value: string; bold?: boolean; accent?: boolean }[] = [
    { label: "Subtotal", value: formatINR(invoice.subtotalPaise) },
  ];
  if (invoice.taxPaise > 0) {
    rows.push({ label: settings.payments.taxLabel || "Tax", value: formatINR(invoice.taxPaise) });
  }
  rows.push({ label: "Total", value: formatINR(invoice.totalPaise), bold: true, accent: true });
  rows.push({ label: "Amount Paid", value: formatINR(invoice.amountPaidPaise) });
  const balance = Math.max(0, invoice.totalPaise - invoice.amountPaidPaise);
  if (balance > 0) rows.push({ label: "Balance Due", value: formatINR(balance), bold: true });

  for (const row of rows) {
    doc.font(row.bold ? "Helvetica-Bold" : "Helvetica").fontSize(row.accent ? 12 : 9);
    doc.fillColor(row.accent ? ACCENT : "#1e293b");
    doc.text(row.label, startX, y, { width: boxWidth * 0.48 });
    doc.text(row.value, startX + boxWidth * 0.48, y, { width: boxWidth * 0.52, align: "right" });
    y += row.accent ? 20 : 16;
  }

  // Amount in words
  doc.moveTo(50, y + 6).lineTo(doc.page.width - 50, y + 6).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
  doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("AMOUNT IN WORDS", 50, y + 12);
  doc.font("Helvetica").fontSize(8.5).fillColor("#1e293b").text(amountToWords(invoice.totalPaise / 100), 50, y + 24);
}

function drawFooter(doc: PdfDocumentWithTable, settings: AppSettings) {
  const year = new Date().getFullYear();
  doc.fillColor(MUTED).fontSize(7);
  doc.text(
    `${settings.payments.invoiceNotes || "Thank you for your business."}`,
    50,
    doc.page.height - 54,
    { width: doc.page.width - 100, align: "center" }
  );
  doc
    .text(
      `This is a computer-generated invoice. © ${year} ${settings.general.agencyName}. All rights reserved.`,
      50,
      doc.page.height - 38,
      { width: doc.page.width - 100, align: "center" }
    );
}

export function generateInvoicePdf(
  invoice: Invoice,
  client: Client | null,
  website: Website | null,
  settings: AppSettings
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true }) as PdfDocumentWithTable;
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, settings, "TAX INVOICE", `Invoice ${invoice.invoiceNumber}`);

    // Invoice meta strip
    doc.fillColor("#f1f5f9").rect(0, 112, doc.page.width, 26).fill();
    doc.fillColor("#1e293b").fontSize(8);
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 50, 121);
    doc.text(`Issue Date: ${formatDateIST(invoice.issueDate)}`, 230, 121);
    if (invoice.dueDate) doc.text(`Due Date: ${formatDateIST(invoice.dueDate)}`, 400, 121);

    // Info boxes
    const boxY = 150;
    const billTo = [
      client?.name ?? "—",
      client?.businessName ?? "",
      client?.contactPerson ?? "",
      client?.address ? client.address : "",
      client?.city ? `${client.city}${client.state ? `, ${client.state}` : ""} ${client.pinCode ?? ""}`.trim() : "",
      client?.mobile ? `Mobile: ${client.mobile}` : "",
      client?.email ? `Email: ${client.email}` : "",
    ].filter(Boolean) as string[];
    drawInfoBox(doc, 50, boxY, 235, "Bill To", billTo);

    const websiteLines = [
      website?.name ?? "—",
      ...(website?.domains?.length ? [`Domain: ${website.domains.find((d) => d.isPrimary)?.domain ?? website.domains[0]?.domain ?? ""}`] : []),
      invoice.invoiceType === "amc" ? "Service: Annual Maintenance Contract" : `Service: ${invoice.invoiceType.replace(/_/g, " ")}`,
      `Status: ${invoice.status.replace(/_/g, " ").toUpperCase()}`,
    ].filter(Boolean) as string[];
    drawInfoBox(doc, 305, boxY, 240, "Website", websiteLines);

    // Line items table
    const tableTop = boxY + Math.max(billTo.length, websiteLines.length) * 13 + 34;
    const tableBottom = drawTable(doc, invoice, settings, tableTop);
    drawTotals(doc, invoice, settings, tableBottom);

    drawFooter(doc, settings);
    doc.end();
  });
}

export function generateReceiptPdf(
  payment: Payment,
  client: Client | null,
  website: Website | null,
  settings: AppSettings
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true }) as PdfDocumentWithTable;
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, settings, "PAYMENT RECEIPT", `Receipt ${payment.paymentCode}`);

    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text(formatINR(payment.amountPaise), 50, 150);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(MUTED)
      .text("Amount Received", 50, 148 + 34);

    const meta = [
      ["Receipt No", payment.paymentCode],
      ["Payment Date", formatDateIST(payment.paymentDate ?? payment.createdAt)],
      ["Method", payment.method.replace(/_/g, " ").toUpperCase()],
      ["Purpose", payment.purpose.replace(/_/g, " ").toUpperCase()],
      ["Status", payment.status.replace(/_/g, " ").toUpperCase()],
    ];
    if (payment.transactionRef) meta.push(["Reference", payment.transactionRef]);
    if (payment.razorpayPaymentId) meta.push(["Razorpay Payment ID", payment.razorpayPaymentId]);

    let y = 250;
    for (const [label, value] of meta) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(label.toUpperCase(), 50, y);
      doc.font("Helvetica").fontSize(10).fillColor("#1e293b").text(value, 210, y);
      y += 22;
    }

    y += 16;
    if (client) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("RECEIVED FROM", 50, y);
      doc.font("Helvetica").fontSize(11).fillColor(NAVY).text(client.name, 50, y + 14);
      if (client.businessName) doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(client.businessName, 50, y + 30);
      if (client.mobile) doc.text(client.mobile, 50, y + 46);
      y += 70;
    }
    if (website) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("WEBSITE", 50, y);
      doc.font("Helvetica").fontSize(10).fillColor("#1e293b").text(website.name, 50, y + 14);
    }

    drawFooter(doc, settings);
    doc.end();
  });
}
