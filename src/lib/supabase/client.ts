"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Browser Supabase client. Only the anon key is exposed here.
 * The admin portal is server-driven, so the browser client is used only for
 * narrow public features. Business data is never queried from the browser
 * with this client.
 */

const globalForSupabase = globalThis as unknown as {
  __codewizardSupabaseBrowser?: SupabaseClient;
};

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!config.supabase.url || !config.supabase.anonKey) return null;
  if (!globalForSupabase.__codewizardSupabaseBrowser) {
    globalForSupabase.__codewizardSupabaseBrowser = createClient(
      config.supabase.url,
      config.supabase.anonKey
    );
  }
  return globalForSupabase.__codewizardSupabaseBrowser;
}
