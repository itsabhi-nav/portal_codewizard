import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { ok, unauthorized } from "@/lib/api";
import { runAmcCheck } from "@/lib/cron/amc-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only manual trigger for testing and recovery. */
export async function POST() {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const result = await runAmcCheck(getSupabase(), "manual");
  return ok(result);
}
