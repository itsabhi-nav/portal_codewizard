import { isSupabaseConfigured } from "@/lib/config";

/**
 * True when Supabase credentials are present. Used by admin pages to render a
 * friendly preview state instead of throwing when the database is not set up.
 */
export function databaseReady(): boolean {
  return isSupabaseConfigured();
}
