import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIST } from "@/lib/dates";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { nextInvoiceNumber } from "@/lib/ids";
import { getAppSettings } from "@/lib/settings";

export interface AutoInvoiceItem {
  description: string;
  quantity: number;
  unitPricePaise: number;
  taxRatePercent?: number;
}

export interface AutoInvoiceInput {
  clientId: string;
  websiteId?: string | null;
  invoiceType: "development" | "amc" | "additional_service" | "hosting" | "other";
  issueDate: string;
  dueDate?: string | null;
  items: AutoInvoiceItem[];
  notes?: string | null;
  /** Defaults to "sent". Pass "paid" for payments that have already been collected. */
  status?: "sent" | "paid";
  createdBy?: string;
  paymentId?: string | null;
}

/**
 * Create a fully-itemized invoice with auto-numbering.
 * Used to auto-generate invoices on record creation and on AMC renewals.
 */
export async function createInvoiceWithItems(
  client: SupabaseClient,
  input: AutoInvoiceInput
): Promise<{ invoiceId: string; invoiceNumber: string } | null> {
  try {
    const settings = await getAppSettings(client);
    const invoiceNumber = await nextInvoiceNumber(client, settings.general.invoicePrefix);

    const items = input.items
      .filter((item) => item.unitPricePaise > 0)
      .map((item, index) => {
        const quantity = Number(item.quantity) || 1;
        const amount = Math.round(quantity * Number(item.unitPricePaise));
        return {
          description: item.description,
          quantity,
          unit_price_paise: Number(item.unitPricePaise),
          amount_paise: amount,
          tax_rate_percent: item.taxRatePercent ?? 0,
          sort_order: index,
        };
      });

    if (items.length === 0) return null;

    const subtotal = items.reduce((sum, item) => sum + item.amount_paise, 0);
    const taxRate = settings.payments.taxEnabled ? settings.payments.taxRatePercent : 0;
    const tax = Math.round((subtotal * taxRate) / 100);
    const total = subtotal + tax;
    const status = input.status ?? "sent";
    const amountPaid = status === "paid" ? total : 0;

    const { data: invoice, error } = await client
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        client_id: input.clientId,
        website_id: input.websiteId ?? null,
        invoice_type: input.invoiceType,
        issue_date: input.issueDate,
        due_date: input.dueDate ?? null,
        subtotal_paise: subtotal,
        tax_paise: tax,
        total_paise: total,
        amount_paid_paise: amountPaid,
        status,
        tax_rate_percent: taxRate,
        notes: input.notes ?? null,
        created_by: input.createdBy ?? "system",
      })
      .select("id")
      .single();

    if (error || !invoice) {
      console.error("[auto-invoice] create failed", error);
      return null;
    }

    const { error: itemsError } = await client
      .from("invoice_items")
      .insert(items.map((item) => ({ ...item, invoice_id: invoice.id })));

    if (itemsError) {
      console.error("[auto-invoice] items failed", itemsError);
      return { invoiceId: invoice.id, invoiceNumber };
    }

    await logActivity(client, {
      eventType: ActivityEventTypes.InvoiceCreated,
      clientId: input.clientId,
      websiteId: input.websiteId,
      actor: input.createdBy ?? "system",
      description: `Auto-generated invoice ${invoiceNumber} (${status})`,
      newValue: { invoiceNumber, totalPaise: total, status },
    });

    return { invoiceId: invoice.id, invoiceNumber };
  } catch (error) {
    console.error("[auto-invoice] unexpected error", error);
    return null;
  }
}

/** Auto-generate a PAID invoice for an AMC renewal payment. */
export async function createAmcInvoiceForPayment(
  client: SupabaseClient,
  input: { clientId: string; websiteId: string; websiteName: string; amountPaise: number; method: string; createdBy?: string }
): Promise<void> {
  await createInvoiceWithItems(client, {
    clientId: input.clientId,
    websiteId: input.websiteId,
    invoiceType: "amc",
    issueDate: todayIST(),
    items: [
      {
        description: `AMC renewal — ${input.websiteName}`,
        quantity: 1,
        unitPricePaise: input.amountPaise,
      },
    ],
    status: "paid",
    createdBy: input.createdBy ?? "system",
    notes: `Auto-generated for AMC payment via ${input.method}`,
  });
}

/**
 * Recalculate an invoice's paid amount and status from immutable payment
 * records. Pending/created/failed payments are never counted as collected.
 */
export async function recalculateInvoice(client: SupabaseClient, invoiceId: string): Promise<void> {
  const { data: invoice } = await client.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) return;

  const { data: payments } = await client
    .from("payments")
    .select("amount_paise, status")
    .eq("invoice_id", invoiceId)
    .eq("status", "successful");

  const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount_paise), 0);
  const total = Number(invoice.total_paise);
  const businessDate = todayIST();

  let status = invoice.status;
  if (paid >= total && total > 0) {
    status = "paid";
  } else if (paid > 0) {
    status = "partially_paid";
  } else if (invoice.status === "paid" || invoice.status === "partially_paid") {
    status = invoice.due_date && invoice.due_date < businessDate ? "overdue" : "sent";
  }

  await client.from("invoices").update({ amount_paid_paise: paid, status }).eq("id", invoiceId);
}

/**
 * Create a payment record and keep invoices in sync.
 * Financial records are treated as immutable; updates only ever append.
 */
export async function recordPayment(
  client: SupabaseClient,
  input: {
    paymentId: string;
    clientId: string;
    websiteId?: string | null;
    invoiceId?: string | null;
    amountPaise: number;
    method: string;
    purpose: string;
    status: string;
    transactionRef?: string | null;
    paymentDate?: string | null;
    notes?: string | null;
    createdBy?: string;
  }
): Promise<void> {
  if (input.invoiceId) {
    await recalculateInvoice(client, input.invoiceId);
  }

  await logActivity(client, {
    eventType: input.status === "successful" ? ActivityEventTypes.PaymentReceived : ActivityEventTypes.PaymentFailed,
    clientId: input.clientId,
    websiteId: input.websiteId,
    actor: input.createdBy ?? "system",
    description: `Payment ${input.paymentId} recorded (${input.status})`,
    newValue: { amountPaise: input.amountPaise, method: input.method, purpose: input.purpose },
  });
}
