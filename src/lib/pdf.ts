import PDFDocument from "pdfkit";
import type { Client, Invoice, Payment, Website } from "@/lib/types";
import type { AppSettings } from "@/lib/settings";
import { formatAmount, formatINR } from "@/lib/money";
import { formatDateIST } from "@/lib/dates";

/**
 * Branded invoice and receipt PDFs.
 * pdfkit with built-in Helvetica (no external font files needed).
 */

const NAVY = "#0b1220";
const ACCENT = "#2563eb";
const ACCENT_SOFT = "#eff6ff";
const MUTED = "#64748b";
const ROWS = ["#ffffff", "#f8fafc"];
const PAGE_MARGIN = 44;
const FOOTER_SPACE = 62;

type PdfDocumentWithTable = PDFKit.PDFDocument;

/** Convert an amount to the Indian numbering system (lakh/crore). */
function amountToWords(totalPaise: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function numberToWords(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
    if (n < 1000) {
      const remainder = n % 100;
      return `${numberToWords(Math.floor(n / 100))} Hundred${remainder ? ` ${numberToWords(remainder)}` : ""}`;
    }
    const scale = n >= 10_000_000 ? 10_000_000 : n >= 100_000 ? 100_000 : 1000;
    const label = scale === 10_000_000 ? "Crore" : scale === 100_000 ? "Lakh" : "Thousand";
    const remainder = n % scale;
    return `${numberToWords(Math.floor(n / scale))} ${label}${remainder ? ` ${numberToWords(remainder)}` : ""}`;
  }

  const safePaise = Math.max(0, Math.round(totalPaise));
  const rupees = Math.floor(safePaise / 100);
  const paise = safePaise % 100;
  let result = `INR ${rupees ? numberToWords(rupees) : "Zero"}`;
  if (paise) result += ` and ${numberToWords(paise)} Paise`;
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

type InvoiceColumn = { label: string; width: number; align: "left" | "center" | "right" };

function drawInvoiceHeader(
  doc: PdfDocumentWithTable,
  invoice: Invoice,
  settings: AppSettings,
  continued = false
): number {
  const width = doc.page.width;
  doc.rect(0, 0, width, 5).fill(ACCENT);
  doc.font("Helvetica-Bold").fontSize(17).fillColor(NAVY)
    .text(settings.general.agencyName || "CodeWizard", PAGE_MARGIN, 26, { width: 285, height: 24, ellipsis: true });

  const contact = [settings.general.websiteUrl, settings.general.supportEmail, settings.general.supportPhone].filter(Boolean);
  if (contact.length) {
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(contact.join("  |  "), PAGE_MARGIN, 53, { width: 300, height: 28, lineGap: 2 });
  }

  const rightX = doc.page.width - PAGE_MARGIN - 190;
  doc.font("Helvetica-Bold").fontSize(14).fillColor(ACCENT)
    .text(continued ? "INVOICE · CONTINUED" : "INVOICE", rightX, 24, { width: 190, align: "right" });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY)
    .text(invoice.invoiceNumber, rightX, 47, { width: 190, align: "right", ellipsis: true });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text(`Issue date  ${formatDateIST(invoice.issueDate)}`, rightX, 64, { width: 190, align: "right" });
  if (invoice.dueDate) {
    doc.text(`Due date  ${formatDateIST(invoice.dueDate)}`, rightX, 77, { width: 190, align: "right" });
  }

  const ruleY = continued ? 98 : 105;
  doc.moveTo(PAGE_MARGIN, ruleY).lineTo(width - PAGE_MARGIN, ruleY).strokeColor("#dbe3ee").lineWidth(0.8).stroke();
  return ruleY + 18;
}

function drawInfoCard(
  doc: PdfDocumentWithTable,
  x: number,
  y: number,
  width: number,
  title: string,
  lines: string[]
): number {
  const bodyWidth = width - 24;
  const bodyOptions = { width: bodyWidth, lineGap: 2 } as const;
  let contentHeight = 0;
  for (const line of lines) {
    doc.font("Helvetica").fontSize(8.5);
    contentHeight += Math.max(11, doc.heightOfString(line, bodyOptions)) + 4;
  }
  const height = 34 + Math.max(contentHeight, 14) + 10;

  doc.roundedRect(x, y, width, height, 5).fill("#f8fafc");
  doc.roundedRect(x, y, width, height, 5).lineWidth(0.7).strokeColor("#e2e8f0").stroke();
  doc.roundedRect(x, y, width, 24, 5).fill(ACCENT_SOFT);
  doc.rect(x, y + 18, width, 6).fill(ACCENT_SOFT);
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(ACCENT)
    .text(title.toUpperCase(), x + 12, y + 8, { width: bodyWidth });

  let textY = y + 32;
  lines.forEach((line, index) => {
    doc.font(index === 0 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(index === 0 ? 9 : 8.5)
      .fillColor(index === 0 ? NAVY : "#334155")
      .text(line, x + 12, textY, bodyOptions);
    textY += Math.max(11, doc.heightOfString(line, bodyOptions)) + 4;
  });
  return y + height;
}

function invoiceColumns(tableWidth: number): InvoiceColumn[] {
  const descriptionWidth = tableWidth * 0.49;
  return [
    { label: "DESCRIPTION", width: descriptionWidth, align: "left" },
    { label: "QTY", width: 43, align: "center" },
    { label: "UNIT PRICE", width: 105, align: "right" },
    { label: "AMOUNT", width: tableWidth - descriptionWidth - 148, align: "right" },
  ];
}

function drawInvoiceTableHeader(doc: PdfDocumentWithTable, y: number, columns: InvoiceColumn[], tableWidth: number) {
  const left = PAGE_MARGIN;
  doc.roundedRect(left, y, tableWidth, 25, 4).fill(NAVY);
  let x = left;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff");
  for (const column of columns) {
    doc.text(column.label, x + 8, y + 9, {
      width: column.width - 16,
      align: column.align,
      lineBreak: false,
    });
    x += column.width;
  }
  return y + 25;
}

function drawInvoiceFooter(doc: PdfDocumentWithTable, settings: AppSettings) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const y = doc.page.height - 46;
    doc.moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y).strokeColor("#e2e8f0").lineWidth(0.7).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(`${settings.general.agencyName || "CodeWizard"}  |  Computer-generated invoice`, PAGE_MARGIN, y + 10, {
        width: doc.page.width - PAGE_MARGIN * 2 - 60,
        lineBreak: false,
        ellipsis: true,
      });
    doc.text(`Page ${index - range.start + 1} of ${range.count}`, doc.page.width - PAGE_MARGIN - 60, y + 10, {
      width: 60,
      align: "right",
      lineBreak: false,
    });
  }
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

    let y = drawInvoiceHeader(doc, invoice, settings);
    const boxY = y;
    const cardGap = 14;
    const cardWidth = (doc.page.width - PAGE_MARGIN * 2 - cardGap) / 2;
    const billTo = [
      client?.name ?? "—",
      client?.businessName ?? "",
      client?.contactPerson ?? "",
      client?.address ?? "",
      [client?.city, client?.state, client?.pinCode].filter(Boolean).join(", "),
      client?.mobile ? `Mobile: ${client.mobile}` : "",
      client?.email ? `Email: ${client.email}` : "",
    ].filter(Boolean);

    const websiteLines = [
      website?.name ?? "No website linked",
      ...(website?.domains?.length ? [`Domain: ${website.domains.find((d) => d.isPrimary)?.domain ?? website.domains[0]?.domain ?? ""}`] : []),
      `Service: ${invoice.invoiceType.replace(/_/g, " ")}`,
      `Invoice status: ${invoice.status.replace(/_/g, " ")}`,
    ];
    const billToBottom = drawInfoCard(doc, PAGE_MARGIN, boxY, cardWidth, "Bill to", billTo);
    const websiteBottom = drawInfoCard(doc, PAGE_MARGIN + cardWidth + cardGap, boxY, cardWidth, "Service details", websiteLines);
    y = Math.max(billToBottom, websiteBottom) + 22;

    const tableWidth = doc.page.width - PAGE_MARGIN * 2;
    const columns = invoiceColumns(tableWidth);
    const tableLeft = PAGE_MARGIN;
    const descriptionWidth = columns[0].width - 20;
    y = drawInvoiceTableHeader(doc, y, columns, tableWidth);
    let rowIndex = 0;
    const items = invoice.items ?? [];

    for (const item of items) {
      doc.font("Helvetica").fontSize(8.5);
      const descriptionHeight = doc.heightOfString(item.description, { width: descriptionWidth, lineGap: 2 });
      const rowHeight = Math.max(30, descriptionHeight + 16);
      if (y + rowHeight > doc.page.height - FOOTER_SPACE) {
        doc.addPage({ size: "A4", margin: 0 });
        y = drawInvoiceHeader(doc, invoice, settings, true);
        y = drawInvoiceTableHeader(doc, y, columns, tableWidth);
      }

      doc.rect(tableLeft, y, tableWidth, rowHeight).fill(ROWS[rowIndex % ROWS.length]);
      doc.moveTo(tableLeft, y + rowHeight).lineTo(tableLeft + tableWidth, y + rowHeight)
        .strokeColor("#e2e8f0").lineWidth(0.45).stroke();

      const cells = [
        item.description,
        new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(item.quantity),
        `INR ${formatAmount(item.unitPricePaise)}`,
        `INR ${formatAmount(item.amountPaise)}`,
      ];
      let x = tableLeft;
      cells.forEach((value, index) => {
        const column = columns[index];
        doc.font(index === 0 ? "Helvetica" : "Helvetica").fontSize(8.5).fillColor("#1e293b")
          .text(value, x + 8, y + 9, {
            width: column.width - 16,
            align: column.align,
            lineGap: 2,
          });
        x += column.width;
      });
      y += rowHeight;
      rowIndex += 1;
    }

    const balance = Math.max(0, invoice.totalPaise - invoice.amountPaidPaise);
    const totalRows = [
      { label: "Subtotal", value: `INR ${formatAmount(invoice.subtotalPaise)}` },
      ...(invoice.taxPaise > 0
        ? [{
            label: `${settings.payments.taxLabel || "Tax"}${invoice.taxRatePercent > 0 ? ` (${invoice.taxRatePercent}%)` : ""}`,
            value: `INR ${formatAmount(invoice.taxPaise)}`,
          }]
        : []),
      { label: "Amount paid", value: `INR ${formatAmount(invoice.amountPaidPaise)}` },
      { label: "Balance due", value: `INR ${formatAmount(balance)}` },
    ];
    const summaryHeight = totalRows.length * 20 + 82;
    const notes = [invoice.notes, settings.payments.invoiceNotes].filter((value): value is string => Boolean(value?.trim()));
    doc.font("Helvetica").fontSize(8);
    const notesHeight = notes.reduce(
      (height, note) => height + doc.heightOfString(note, { width: tableWidth, lineGap: 2 }) + 16,
      notes.length ? 18 : 0
    );
    if (y + 22 + summaryHeight + notesHeight > doc.page.height - FOOTER_SPACE) {
      doc.addPage({ size: "A4", margin: 0 });
      y = drawInvoiceHeader(doc, invoice, settings, true);
    } else {
      y += 22;
    }

    const summaryWidth = 245;
    const summaryX = doc.page.width - PAGE_MARGIN - summaryWidth;
    doc.moveTo(summaryX, y).lineTo(doc.page.width - PAGE_MARGIN, y).strokeColor(ACCENT).lineWidth(1.2).stroke();
    y += 12;

    doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY)
      .text("TOTAL", summaryX, y + 3, { width: summaryWidth * 0.45 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(ACCENT)
      .text(`INR ${formatAmount(invoice.totalPaise)}`, summaryX + summaryWidth * 0.45, y + 3, {
        width: summaryWidth * 0.55,
        align: "right",
      });
    y += 28;

    totalRows.forEach((row) => {
      doc.font("Helvetica").fontSize(8.5).fillColor("#334155")
        .text(row.label, summaryX, y, { width: summaryWidth * 0.55 });
      doc.text(row.value, summaryX + summaryWidth * 0.55, y, {
        width: summaryWidth * 0.45,
        align: "right",
      });
      y += 18;
    });

    y += 8;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
      .text("AMOUNT IN WORDS", PAGE_MARGIN, y, { width: tableWidth });
    y += 12;
    doc.font("Helvetica").fontSize(8.5).fillColor("#334155")
      .text(amountToWords(invoice.totalPaise), PAGE_MARGIN, y, { width: tableWidth, lineGap: 2 });
    y += doc.heightOfString(amountToWords(invoice.totalPaise), { width: tableWidth, lineGap: 2 }) + 16;

    for (const [index, note] of notes.entries()) {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
        .text(index === 0 && invoice.notes ? "NOTES" : "PAYMENT / BUSINESS NOTES", PAGE_MARGIN, y, { width: tableWidth });
      y += 11;
      doc.font("Helvetica").fontSize(8).fillColor("#334155")
        .text(note, PAGE_MARGIN, y, { width: tableWidth, lineGap: 2 });
      y += doc.heightOfString(note, { width: tableWidth, lineGap: 2 }) + 12;
    }

    drawInvoiceFooter(doc, settings);
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
