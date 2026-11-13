import { z } from "zod";
import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, ok, parseJsonBody, unauthorized } from "@/lib/api";
import {
  getAdminNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import { mapAdminNotification } from "@/lib/mappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const client = getSupabase();
  const [notifications, unreadCount] = await Promise.all([
    getAdminNotifications(client, 100),
    getUnreadNotificationCount(client),
  ]);

  return ok({
    items: notifications.map(mapAdminNotification),
    unreadCount,
  });
}

const patchSchema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await parseJsonBody(request, patchSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  if (body.data.all) {
    await markAllNotificationsRead(client);
  } else if (body.data.id) {
    await markNotificationRead(client, body.data.id);
  } else {
    return badRequest("Provide an id or set all to true");
  }

  const unreadCount = await getUnreadNotificationCount(client);
  return ok({ unreadCount });
}
