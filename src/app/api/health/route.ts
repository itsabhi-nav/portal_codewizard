import { config, isRazorpayConfigured, isSupabaseConfigured, validateEnvironment } from "@/lib/config";
import { ok } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public health endpoint. Reports configuration status without leaking any
 * secret values. Used by uptime monitors and the admin system-health page.
 */
export async function GET() {
  const env = validateEnvironment();

  let database: "ok" | "unreachable" = "unreachable";
  let databaseLatencyMs: number | null = null;

  if (isSupabaseConfigured()) {
    const started = Date.now();
    try {
      const client = getSupabaseAdmin();
      const { error } = await client.from("application_settings").select("key").limit(1);
      databaseLatencyMs = Date.now() - started;
      database = error ? "unreachable" : "ok";
    } catch {
      database = "unreachable";
    }
  }

  return ok({
    status: database === "ok" ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    checks: {
      environment: { ok: env.valid, missing: env.missing.map((m) => m.key) },
      database: { ok: database === "ok", latencyMs: databaseLatencyMs },
      supabase: { configured: isSupabaseConfigured() },
      razorpay: { configured: isRazorpayConfigured(), enabled: config.razorpay.enabled },
      license: { configured: Boolean(config.license.signingSecret) },
    },
  });
}
