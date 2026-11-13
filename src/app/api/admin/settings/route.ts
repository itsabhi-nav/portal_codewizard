import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { ok, parseJsonBody, unauthorized } from "@/lib/api";
import { settingsUpdateSchema } from "@/lib/validation";
import { getAppSettings, updateAppSettings } from "@/lib/settings";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { validateEnvironment } from "@/lib/config";
import { cacheStats } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const client = getSupabase();
  const settings = await getAppSettings(client);
  const env = validateEnvironment();

  return ok({
    settings,
    system: {
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timezone: settings.general.timezone,
        appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL,
        configured: env.valid,
        missingKeys: env.missing.map((m) => m.key),
      },
      licenseCache: cacheStats(),
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      razorpayEnabled: process.env.RAZORPAY_ENABLED === "true",
      whatsappBaseUrl: process.env.WHATSAPP_BASE_URL || "https://wa.me/",
    },
  });
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await parseJsonBody(request, settingsUpdateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const next = await updateAppSettings(client, body.data, session.username);

  await logActivity(client, {
    eventType: ActivityEventTypes.SettingsUpdated,
    actor: session.username,
    description: "Application settings updated",
    newValue: body.data,
  });

  return ok(next);
}
