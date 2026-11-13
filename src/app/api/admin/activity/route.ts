import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, escapeSearch, ok, unauthorized } from "@/lib/api";
import { getPagination } from "@/lib/api";
import { mapActivityLog } from "@/lib/mappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const searchParams = new URL(request.url).searchParams;
  const pagination = getPagination(searchParams, 100);
  const eventType = searchParams.get("eventType");
  const clientId = searchParams.get("clientId");
  const websiteId = searchParams.get("websiteId");
  const actor = searchParams.get("actor");
  const search = searchParams.get("search")?.trim();

  let query = getSupabase()
    .from("activity_logs")
    .select("*, client:clients(id, name), website:websites(id, name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (eventType) query = query.eq("event_type", eventType);
  if (clientId) query = query.eq("client_id", clientId);
  if (websiteId) query = query.eq("website_id", websiteId);
  if (actor) query = query.eq("actor", actor);
  if (search) {
    const escaped = escapeSearch(search);
    query = query.ilike("description", `%${escaped}%`);
  }
  query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

  const { data, error, count } = await query;
  if (error) return badRequest("Failed to load activity logs");

  return ok({
    items: (data ?? []).map((row) => ({
      ...mapActivityLog(row),
      clientName: row.client?.name ?? null,
      websiteName: row.website?.name ?? null,
    })),
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
}
