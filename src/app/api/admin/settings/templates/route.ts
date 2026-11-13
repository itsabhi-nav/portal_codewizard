import { z } from "zod";
import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { templateUpdateSchema } from "@/lib/validation";
import { mapNotificationTemplate } from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const client = getSupabase();
  const { data, error } = await client
    .from("notification_templates")
    .select("*")
    .order("key", { ascending: true });
  if (error) return badRequest("Failed to load templates");

  return ok((data ?? []).map(mapNotificationTemplate));
}

const upsertSchema = z.array(templateUpdateSchema);

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await parseJsonBody(request, upsertSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  for (const template of body.data) {
    const { key, ...patch } = template;
    const { error } = await client
      .from("notification_templates")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) return badRequest(`Failed to update template ${key}`);
  }

  await logActivity(client, {
    eventType: ActivityEventTypes.SettingsUpdated,
    actor: session.username,
    description: "Notification templates updated",
  });

  const { data } = await client.from("notification_templates").select("*").order("key", { ascending: true });
  return ok((data ?? []).map(mapNotificationTemplate));
}
