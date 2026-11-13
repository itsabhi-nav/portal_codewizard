import { getAdminSession, type AdminSession } from "@/lib/auth";

/**
 * Server-side authorization guard for admin API routes.
 * Returns the session when authenticated, otherwise null.
 * Every admin API route must call this.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  try {
    return await getAdminSession();
  } catch {
    return null;
  }
}

/** Throwing variant for server components / route handlers. */
export async function requireAdminOrThrow(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
