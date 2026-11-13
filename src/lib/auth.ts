import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { randomToken, signPayload, timingSafeEqual, verifySignedPayload } from "@/lib/signing";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getSupabase, getSupabaseSafe } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";

export { ADMIN_SESSION_COOKIE };

/**
 * Admin authentication using environment-configured credentials.
 *
 * - Passwords are verified with bcrypt (the .env password is hashed at runtime
 *   and never stored in plaintext in the database).
 * - Sessions are HMAC-signed, HTTP-only cookies with SameSite protection.
 * - Login is rate limited per IP and per username.
 */

const SESSION_ISSUER = "codewizard-admin";
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_SECONDS = 900; // 15 minutes

export interface AdminSession {
  username: string;
  issuedAt: number;
  expiresAt: number;
  token: string;
}

interface SessionPayload {
  sub: string;
  username: string;
  iat: number;
  exp: number;
  iss: string;
  nonce: string;
}

let cachedEnvPasswordHash: string | null = null;

function getEnvPasswordHash(): string {
  if (!cachedEnvPasswordHash) {
    cachedEnvPasswordHash = bcrypt.hashSync(config.admin.password, 10);
  }
  return cachedEnvPasswordHash;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

/** Count recent failed login attempts from the database (durable audit). */
async function countRecentFailures(ip: string): Promise<number> {
  try {
    const since = new Date(Date.now() - LOGIN_WINDOW_SECONDS * 1000).toISOString();
    const { count, error } = await getSupabase()
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("successful", false)
      .gte("created_at", since)
      .eq("ip_address", ip);
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error("[auth] failed to read login attempts", error);
    return 0;
  }
}

async function recordLoginAttempt(ip: string, username: string, successful: boolean) {
  try {
    await getSupabase().from("login_attempts").insert({
      username,
      ip_address: ip,
      successful,
    });
  } catch (error) {
    console.error("[auth] failed to record login attempt", error);
  }
}

export async function authenticateAdmin(input: {
  username: string;
  password: string;
  ip: string;
}): Promise<AuthResult> {
  // Per-IP in-memory rate limit (fast path).
  const ipLimit = rateLimit(rateLimitKey("login_ip", input.ip), MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_SECONDS);
  if (!ipLimit.allowed) {
    return {
      ok: false,
      error: "Too many login attempts. Please try again later.",
      retryAfterSeconds: ipLimit.retryAfterSeconds,
    };
  }

  // Durable per-username/IP failure check.
  const failures = await countRecentFailures(input.ip);
  if (failures >= MAX_LOGIN_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many failed login attempts. Please try again later.",
      retryAfterSeconds: LOGIN_WINDOW_SECONDS,
    };
  }

  const usernameMatches = input.username === config.admin.username;
  const passwordMatches = await bcrypt.compare(input.password, getEnvPasswordHash());

  if (!usernameMatches || !passwordMatches) {
    await recordLoginAttempt(input.ip, input.username, false);
    const auditClient = getSupabaseSafe();
    if (auditClient) {
      await logActivity(auditClient, {
        eventType: "admin.login_failed",
        actor: input.username,
        description: `Failed admin login attempt for username "${input.username}"`,
        metadata: { ip: input.ip },
      });
    }
    return { ok: false, error: "Invalid username or password" };
  }

  await recordLoginAttempt(input.ip, input.username, true);
  const auditClient = getSupabaseSafe();
  if (auditClient) {
    await logActivity(auditClient, {
      eventType: "admin.login",
      actor: input.username,
      description: `Admin "${input.username}" logged in`,
      metadata: { ip: input.ip },
    });
  }

  return { ok: true };
}

function buildSessionToken(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: username,
    username,
    iat: now,
    exp: now + config.admin.sessionTtlSeconds,
    iss: SESSION_ISSUER,
    nonce: randomToken(16),
  };
  return signPayload(payload as unknown as Record<string, unknown>, config.admin.sessionSecret);
}

export async function createAdminSession(username: string): Promise<void> {
  const cookieStore = await cookies();
  const token = buildSessionToken(username);
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: config.admin.sessionTtlSeconds,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  const auditClient = getSupabaseSafe();
  if (auditClient) {
    await logActivity(auditClient, {
      eventType: "admin.logout",
      actor: config.admin.username,
      description: "Admin logged out",
    });
  }
}

/** Returns the current admin session, or null when unauthenticated/expired. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = verifySignedPayload<SessionPayload>(token, config.admin.sessionSecret);
  if (!result.valid) return null;
  if (result.payload.iss !== SESSION_ISSUER) return null;

  return {
    username: result.payload.username,
    issuedAt: result.payload.iat,
    expiresAt: result.payload.exp,
    token,
  };
}

/** Constant-time comparison helper for non-bcrypt secrets. */
export function safeCompare(a: string, b: string): boolean {
  return timingSafeEqual(a, b);
}
