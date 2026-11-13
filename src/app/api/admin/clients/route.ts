import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, escapeSearch, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { getPagination } from "@/lib/api";
import { clientCreateSchema } from "@/lib/validation";
import { mapClient } from "@/lib/mappers";
import { nextClientCode } from "@/lib/ids";
import { logActivity, ActivityEventTypes } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const searchParams = new URL(request.url).searchParams;
  const pagination = getPagination(searchParams);
  const search = searchParams.get("search")?.trim();
  const archived = searchParams.get("archived") === "true";
  const sort = searchParams.get("sort") || "created_at";
  const order = searchParams.get("order") === "asc" ? "ascending" : "descending";

  let query = getSupabase()
    .from("clients")
    .select("*", { count: "exact" })
    .order(sort, { ascending: order === "ascending" });

  if (!archived) query = query.eq("archived", false);
  if (search) {
    const escaped = escapeSearch(search);
    query = query.or(
      `name.ilike.%${escaped}%,business_name.ilike.%${escaped}%,mobile.ilike.%${escaped}%,client_code.ilike.%${escaped}%,contact_person.ilike.%${escaped}%`
    );
  }

  query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[clients:list]", error);
    return badRequest("Failed to load clients");
  }

  return ok({
    items: (data ?? []).map(mapClient),
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await parseJsonBody(request, clientCreateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const clientCode = await nextClientCode(client);

  const { data, error } = await client
    .from("clients")
    .insert({
      client_code: clientCode,
      name: body.data.name,
      business_name: body.data.businessName ?? null,
      contact_person: body.data.contactPerson ?? null,
      mobile: body.data.mobile ?? null,
      whatsapp_number: body.data.whatsappNumber ?? null,
      email: body.data.email ?? null,
      address: body.data.address ?? null,
      city: body.data.city ?? null,
      state: body.data.state ?? null,
      pin_code: body.data.pinCode ?? null,
      notes: body.data.notes ?? null,
      created_by: session.username,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[clients:create]", error);
    return badRequest("Failed to create client");
  }

  await logActivity(client, {
    eventType: ActivityEventTypes.ClientCreated,
    clientId: data.id,
    actor: session.username,
    description: `Client "${data.name}" created (${clientCode})`,
    newValue: mapClient(data),
  });

  return ok(mapClient(data), { status: 201 });
}
