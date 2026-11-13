import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * This bypasses Row Level Security and must only ever run on the server.
 * Never import this from a Client Component.
 */

const globalForSupabase = globalThis as unknown as {
  __codewizardSupabaseAdmin?: SupabaseClient;
};

export function getSupabaseAdmin(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment. See DEPLOYMENT.md."
    );
  }

  if (!globalForSupabase.__codewizardSupabaseAdmin) {
    globalForSupabase.__codewizardSupabaseAdmin = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: "public",
        },
      }
    );
  }

  return globalForSupabase.__codewizardSupabaseAdmin;
}

/** Non-throwing variant for public endpoints. Returns null when unconfigured. */
export function getSupabaseAdminOrNull(): SupabaseClient | null {
  try {
    return getSupabaseAdmin();
  } catch {
    return null;
  }
}
