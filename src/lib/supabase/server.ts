import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * React-cached Supabase client for server components and route handlers.
 * Deduplicates client creation within a single request render pass.
 */
export const getSupabase = cache((): SupabaseClient => getSupabaseAdmin());

/**
 * Non-throwing variant for best-effort audit logging. Returns null when
 * Supabase is not configured so callers can skip logging without crashing the
 * primary operation.
 */
export function getSupabaseSafe(): SupabaseClient | null {
  try {
    return getSupabase();
  } catch {
    return null;
  }
}
