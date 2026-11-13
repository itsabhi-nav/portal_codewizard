import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, escapeSearch, unauthorized } from "@/lib/api";
import { formatINR } from "@/lib/money";
import { formatDateIST, formatDateTimeIST } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CsvValue = string | number | boolean | null | undefined;

function toCsv(rows: CsvValue[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell === null || cell === undefined) return "";
          const value = String(cell);
          if (/[",\n]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    )
    .join("\n");
}

function csvResponse(filename: string, rows: CsvValue[][]): Response {
  const body = "﻿" + toCsv(rows);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

const RESOURCES = ["clients", "websites", "payments", "invoices", "amc", "renewals", "revenue"];

interface ExportFilters {
  search: string;
  clientId: string;
  websiteId: string;
  status: string;
  purpose: string;
  method: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  archived: boolean;
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const params = new URL(request.url).searchParams;
  const resource = params.get("resource") || "";
  if (!RESOURCES.includes(resource)) {
    return badRequest(`Unknown export resource. Use one of: ${RESOURCES.join(", ")}`);
  }

  const filters: ExportFilters = {
    search: params.get("search")?.trim() ?? "",
    clientId: params.get("clientId") ?? "",
    websiteId: params.get("websiteId") ?? "",
    status: params.get("status") ?? "",
    purpose: params.get("purpose") ?? "",
    method: params.get("method") ?? "",
    type: params.get("type") ?? "",
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    archived: params.get("archived") === "true",
  };

  const client = getSupabase();
  const stamp = new Date().toISOString().slice(0, 10);

  switch (resource) {
    case "clients": {
      let query = client.from("clients").select("*").order("created_at", { ascending: false });
      if (!filters.archived) query = query.eq("archived", false);
      if (filters.search) {
        const escaped = escapeSearch(filters.search);
        query = query.or(
          `name.ilike.%${escaped}%,business_name.ilike.%${escaped}%,mobile.ilike.%${escaped}%,client_code.ilike.%${escaped}%`
        );
      }
      const { data } = await query;
      const rows: CsvValue[][] = [
        ["Client Code", "Name", "Business", "Contact Person", "Mobile", "WhatsApp", "Email", "City", "State", "PIN", "Archived", "Created"],
        ...(data ?? []).map((row) => [
          row.client_code,
          row.name,
          row.business_name ?? "",
          row.contact_person ?? "",
          row.mobile ?? "",
          row.whatsapp_number ?? "",
          row.email ?? "",
          row.city ?? "",
          row.state ?? "",
          row.pin_code ?? "",
          row.archived ? "yes" : "no",
          formatDateTimeIST(row.created_at),
        ]),
      ];
      return csvResponse(`codewizard-clients-${stamp}.csv`, rows);
    }

    case "websites": {
      let query = client
        .from("websites")
        .select("*, client:clients(name), domains:website_domains(domain)")
        .order("created_at", { ascending: false });
      if (filters.clientId) query = query.eq("client_id", filters.clientId);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.search) {
        const escaped = escapeSearch(filters.search);
        query = query.ilike("name", `%${escaped}%`);
      }
      const { data } = await query;
      const rows: CsvValue[][] = [
        ["Website ID", "Name", "Client", "Status", "Domain", "Dev Cost (INR)", "Go-live", "Created"],
        ...(data ?? []).map((row) => [
          row.id,
          row.name,
          row.client?.name ?? "",
          row.status,
          (row.domains ?? []).find((d: { is_primary: boolean }) => d.is_primary)?.domain ??
            (row.domains ?? [])[0]?.domain ??
            "",
          formatINR(Number(row.development_cost_paise)),
          formatDateIST(row.go_live_date),
          formatDateTimeIST(row.created_at),
        ]),
      ];
      return csvResponse(`codewizard-websites-${stamp}.csv`, rows);
    }

    case "payments": {
      let query = client
        .from("payments")
        .select("*, client:clients(name), website:websites(name)")
        .order("created_at", { ascending: false });
      if (filters.clientId) query = query.eq("client_id", filters.clientId);
      if (filters.websiteId) query = query.eq("website_id", filters.websiteId);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.purpose) query = query.eq("purpose", filters.purpose);
      if (filters.method) query = query.eq("method", filters.method);
      if (filters.dateFrom) query = query.gte("payment_date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("payment_date", `${filters.dateTo}T23:59:59.999Z`);
      if (filters.search) {
        const escaped = escapeSearch(filters.search);
        query = query.ilike("payment_code", `%${escaped}%`);
      }
      const { data } = await query;
      const rows: CsvValue[][] = [
        ["Payment Code", "Date", "Client", "Website", "Purpose", "Method", "Status", "Amount (INR)", "Reference"],
        ...(data ?? []).map((row) => [
          row.payment_code,
          formatDateTimeIST(row.payment_date ?? row.created_at),
          row.client?.name ?? "",
          row.website?.name ?? "",
          row.purpose,
          row.method,
          row.status,
          formatINR(Number(row.amount_paise)),
          row.transaction_ref ?? row.razorpay_payment_id ?? "",
        ]),
      ];
      return csvResponse(`codewizard-payments-${stamp}.csv`, rows);
    }

    case "invoices": {
      let query = client
        .from("invoices")
        .select("*, client:clients(name), website:websites(name)")
        .order("created_at", { ascending: false });
      if (filters.clientId) query = query.eq("client_id", filters.clientId);
      if (filters.websiteId) query = query.eq("website_id", filters.websiteId);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.type) query = query.eq("invoice_type", filters.type);
      if (filters.search) {
        const escaped = escapeSearch(filters.search);
        query = query.ilike("invoice_number", `%${escaped}%`);
      }
      const { data } = await query;
      const rows: CsvValue[][] = [
        ["Invoice", "Date", "Due", "Client", "Website", "Type", "Status", "Total (INR)", "Paid (INR)", "Balance (INR)"],
        ...(data ?? []).map((row) => [
          row.invoice_number,
          formatDateIST(row.issue_date),
          formatDateIST(row.due_date),
          row.client?.name ?? "",
          row.website?.name ?? "",
          row.invoice_type,
          row.status,
          formatINR(Number(row.total_paise)),
          formatINR(Number(row.amount_paid_paise)),
          formatINR(Math.max(0, Number(row.total_paise) - Number(row.amount_paid_paise))),
        ]),
      ];
      return csvResponse(`codewizard-invoices-${stamp}.csv`, rows);
    }

    case "amc": {
      let query = client
        .from("amc_contracts")
        .select(
          "*, website:websites(id, name, client:clients(name)) "
        )
        .order("created_at", { ascending: false });
      if (filters.websiteId) query = query.eq("website_id", filters.websiteId);
      const { data } = await query;
      const filtered = (data ?? []).filter((row) => {
        if (!filters.status) return true;
        if (filters.status === "disabled") return !row.enabled;
        if (filters.status === "suspended") {
          return row.status === "suspended" || row.access_status === "suspended" || row.access_status === "manual_suspended";
        }
        return row.status === filters.status;
      });
      const rows: CsvValue[][] = [
        ["Website", "Client", "Status", "Access", "Enabled", "Exempt", "Renewal Price (INR)", "Validity Start", "Validity End", "Next Expiry"],
        ...filtered.map((row) => [
          row.website?.name ?? "",
          row.website?.client?.name ?? "",
          row.status,
          row.access_status,
          row.enabled ? "yes" : "no",
          row.exempt ? "yes" : "no",
          formatINR(Number(row.renewal_price_paise)),
          formatDateIST(row.validity_start),
          formatDateIST(row.validity_end),
          formatDateIST(row.next_expiry_date),
        ]),
      ];
      return csvResponse(`codewizard-amc-${stamp}.csv`, rows);
    }

    case "renewals": {
      let query = client
        .from("amc_periods")
        .select("*, website:websites(name), payment:payments(payment_code, amount_paise, status)")
        .order("start_date", { ascending: false });
      if (filters.websiteId) query = query.eq("website_id", filters.websiteId);
      const { data } = await query;
      const rows: CsvValue[][] = [
        ["Website", "Period Start", "Period End", "Price (INR)", "Status", "Payment", "Payment Status"],
        ...(data ?? []).map((row) => [
          row.website?.name ?? "",
          formatDateIST(row.start_date),
          formatDateIST(row.end_date),
          formatINR(Number(row.price_paise)),
          row.status,
          row.payment?.payment_code ?? "",
          row.payment?.status ?? "",
        ]),
      ];
      return csvResponse(`codewizard-renewals-${stamp}.csv`, rows);
    }

    case "revenue": {
      let query = client
        .from("payments")
        .select("*, client:clients(name), website:websites(name)")
        .eq("status", "successful")
        .order("payment_date", { ascending: true });
      if (filters.dateFrom) query = query.gte("payment_date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("payment_date", `${filters.dateTo}T23:59:59.999Z`);
      const { data } = await query;
      const rows: CsvValue[][] = [
        ["Month", "Development (INR)", "AMC (INR)", "Other (INR)", "Total (INR)"],
      ];
      const buckets = new Map<string, { development: number; amc: number; other: number }>();
      for (const row of data ?? []) {
        const key = (row.payment_date ?? row.created_at).slice(0, 7);
        const bucket = buckets.get(key) ?? { development: 0, amc: 0, other: 0 };
        const amount = Number(row.amount_paise);
        if (row.purpose === "development" || row.purpose === "additional_development") bucket.development += amount;
        else if (row.purpose === "amc_renewal") bucket.amc += amount;
        else bucket.other += amount;
        buckets.set(key, bucket);
      }
      for (const [month, bucket] of Array.from(buckets.entries()).sort()) {
        rows.push([
          month,
          formatINR(bucket.development),
          formatINR(bucket.amc),
          formatINR(bucket.other),
          formatINR(bucket.development + bucket.amc + bucket.other),
        ]);
      }
      return csvResponse(`codewizard-revenue-${stamp}.csv`, rows);
    }

    default:
      return badRequest("Unknown export resource");
  }
}
