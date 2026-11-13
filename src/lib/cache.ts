/**
 * In-memory TTL cache for license responses and other hot-path data.
 *
 * Purpose: reduce Supabase queries for high-traffic license verification.
 *
 * Netlify/serverless limitation: this cache is per-instance and not shared
 * across instances. For multi-instance deployments, put a shared cache (e.g.
 * Upstash Redis / Netlify Blobs) in front of this module. The cache is never
 * the authoritative source of truth — the database always is.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 5_000;

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  if (store.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, entry] of store) {
      if (entry.expiresAt <= now) store.delete(k);
    }
    // If still oversized, evict oldest inserted entry.
    if (store.size >= MAX_ENTRIES) {
      const firstKey = store.keys().next().value;
      if (firstKey) store.delete(firstKey);
    }
  }
  store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}

export function cacheStats(): { size: number } {
  return { size: store.size };
}
