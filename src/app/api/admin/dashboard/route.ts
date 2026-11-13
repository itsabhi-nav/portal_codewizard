import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { ok, unauthorized } from "@/lib/api";
import { getDashboardMetrics } from "@/lib/dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const searchParams = new URL(request.url).searchParams;
  const metrics = await getDashboardMetrics(getSupabase(), {
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
  });

  return ok(metrics);
}
