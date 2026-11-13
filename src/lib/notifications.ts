import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminNotificationInput {
  type: string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "error" | "success";
  relatedClientId?: string | null;
  relatedWebsiteId?: string | null;
  /** Unique key used to prevent duplicate notifications. */
  dedupeKey?: string | null;
}

/**
 * Create an admin notification. When a dedupeKey is supplied, repeated
 * notifications with the same key are ignored (idempotent).
 */
export async function notifyAdmin(client: SupabaseClient, input: AdminNotificationInput): Promise<void> {
  try {
    await client
      .from("admin_notifications")
      .upsert(
        {
          type: input.type,
          title: input.title,
          message: input.message,
          severity: input.severity ?? "info",
          related_client_id: input.relatedClientId ?? null,
          related_website_id: input.relatedWebsiteId ?? null,
          dedupe_key: input.dedupeKey ?? null,
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true }
      );
  } catch (error) {
    console.error("[notifications] failed to create notification", error);
  }
}

export async function getAdminNotifications(client: SupabaseClient, limit = 50) {
  const { data, error } = await client
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(client: SupabaseClient, id: string) {
  const { error } = await client
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(client: SupabaseClient) {
  const { error } = await client
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) throw error;
}

export async function getUnreadNotificationCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("admin_notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}
