import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { ok, unauthorized } from "@/lib/api";
import { getPagination } from "@/lib/api";
import { mapCronExecutionLog } from "@/lib/mappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const searchParams = new URL(request.url).searchParams;
  const pagination = getPagination(searchParams, 50);
  const status = searchParams.get("status");

  let query = getSupabase()
    .from("cron_execution_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

  const { data, error, count } = await query;
  if (error) return ok({ items: [], total: 0, page: pagination.page, pageSize: pagination.pageSize });

  return ok({
    items: (data ?? []).map(mapCronExecutionLog),
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
}
