import type { SupabaseClient } from "@supabase/supabase-js";
import { randomToken } from "@/lib/signing";

/** Short, unambiguous public identifier for a website. */
export function generatePublicId(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = randomToken(10);
  for (let i = 0; i < 10; i++) {
    out += alphabet[bytes.charCodeAt(i) % alphabet.length];
  }
  return `cw_${out}`;
}

export function generatePaymentCode(): string {
  return `PAY-${randomToken(8).toUpperCase()}`;
}

export function generateRefundCode(): string {
  return `RFD-${randomToken(8).toUpperCase()}`;
}

export function generateOrderRef(): string {
  return `ord_${randomToken(12)}`;
}

export function generateRunId(): string {
  return `run_${randomToken(10)}`;
}

export function generateLicenseSecret(): string {
  return `cws_${randomToken(32)}`;
}

/** Human-friendly client code using the DB counter, e.g. CLI-00001. */
export async function nextClientCode(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc("next_document_number", { p_prefix: "CLI" });
  if (error) throw error;
  return String(data);
}

export async function nextInvoiceNumber(client: SupabaseClient, prefix: string): Promise<string> {
  const year = new Date().toISOString().slice(0, 4);
  const { data, error } = await client.rpc("next_invoice_number", {
    p_prefix: prefix || "INV",
    p_year: year,
  });
  if (error) throw error;
  return String(data);
}
