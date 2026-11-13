import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { config } from "@/lib/config";
import { getClientIp } from "@/lib/rate-limit";

/** Standard success response envelope. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

/** Standard error response envelope. */
export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { message, details: details ?? null } },
    { status }
  );
}

export function unauthorized(message = "Authentication required") {
  return fail(401, message);
}

export function forbidden(message = "You do not have permission to perform this action") {
  return fail(403, message);
}

export function notFound(message = "Resource not found") {
  return fail(404, message);
}

export function badRequest(message = "Invalid request", details?: unknown) {
  return fail(400, message, details);
}

export function conflict(message: string, details?: unknown) {
  return fail(409, message, details);
}

export function tooManyRequests(message = "Too many requests", retryAfter?: number) {
  return NextResponse.json(
    { success: false, error: { message, details: null } },
    { status: 429, headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined }
  );
}

/** Parse and validate a JSON request body with Zod. */
export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>): Promise<
  { success: true; data: T } | { success: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { success: false, response: badRequest("Request body must be valid JSON") };
  }
  try {
    const data = schema.parse(raw);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        response: badRequest(
          "Validation failed",
          error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
        ),
      };
    }
    throw error;
  }
}

export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

export function getPagination(searchParams: URLSearchParams, maxPageSize = 100): Pagination {
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize") || 20) || 20;
  const pageSize = Math.min(Math.max(1, pageSizeRaw), maxPageSize);
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

/**
 * Basic CSRF protection for mutating requests.
 *
 * A request is allowed when:
 * - it has no Origin header (non-browser client), or
 * - the Origin host matches the request Host header (same-origin), or
 * - the Origin host matches the configured app URL.
 *
 * This works correctly on any local port as well as behind production proxies.
 */
export function checkCsrf(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return forbidden("Invalid Origin header");
  }

  const host = request.headers.get("host");
  if (host && host === originHost) return null;

  try {
    const allowed = new URL(config.serverAppUrl);
    if (allowed.host === originHost) return null;
  } catch {
    // Invalid configured URL — fall through to rejection.
  }

  return forbidden("Cross-origin request rejected");
}

export function requestMeta(request: Request) {
  return {
    ip: getClientIp(request.headers),
    userAgent: request.headers.get("user-agent") || "",
  };
}

/** Returns a value safe for PostgreSQL inet columns (null instead of "unknown"). */
export function safeIp(ip: string): string | null {
  if (!ip || ip === "unknown") return null;
  return ip;
}

/**
 * Escapes user input before it is embedded in a PostgREST `or()` filter
 * expression. Prevents commas, parentheses and quotes from breaking the
 * filter syntax. Intended for search terms only.
 */
export function escapeSearch(value: string): string {
  return value.replace(/[%_,()"'\\]/g, "").trim();
}
