import { config } from "@/lib/config";
import { getSupabaseAdminOrNull } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api";
import { runAmcCheck } from "@/lib/cron/amc-check";
import { logActivity, ActivityEventTypes } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled AMC check endpoint.
 *
 * Protected by CRON_SECRET. Invoke with either:
 *   Authorization: Bearer <CRON_SECRET>
 * or
 *   x-cron-secret: <CRON_SECRET>
 *
 * Recommended schedule: 1:00 AM Asia/Kolkata daily.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const headerSecret = request.headers.get("x-cron-secret");
  const provided = bearer || headerSecret;

  if (!config.cron.secret || !provided || provided !== config.cron.secret) {
    return fail(401, "Invalid or missing cron secret");
  }

  const client = getSupabaseAdminOrNull();
  if (!client) return fail(503, "Cron service unavailable: database is not configured");

  const result = await runAmcCheck(client, "scheduled");

  await logActivity(client, {
    eventType: ActivityEventTypes.CronExecuted,
    actor: "cron",
    description: `Scheduled AMC check finished with status ${result.status}`,
    newValue: { runId: result.runId, status: result.status },
  });

  return ok(result);
}
