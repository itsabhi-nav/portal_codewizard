import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

function createSupabaseStub() {
  const target = function () {} as unknown as Record<string, unknown>;
  return new Proxy(target, {
    get(_target, prop) {
      if (prop === "then") {
        return (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null, count: 0 }).then(onFulfilled);
      }
      if (prop === Symbol.toPrimitive) return () => "";
      return () => stub;
    },
    apply() {
      return stub;
    },
  });
}

const stub: unknown = createSupabaseStub();

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => stub,
  getSupabaseSafe: () => stub,
}));

import {
  authenticateAdmin,
  createAdminSession,
  getAdminSession,
  destroyAdminSession,
  ADMIN_SESSION_COOKIE,
} from "@/lib/auth";

describe("authenticateAdmin", () => {
  beforeEach(() => cookieJar.clear());

  it("accepts the configured admin credentials", async () => {
    const result = await authenticateAdmin({
      username: "admin",
      password: "test-password-123",
      ip: "127.0.0.1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const result = await authenticateAdmin({
      username: "admin",
      password: "wrong-password",
      ip: "127.0.0.1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid username or password");
  });

  it("rejects an incorrect username", async () => {
    const result = await authenticateAdmin({
      username: "not-admin",
      password: "test-password-123",
      ip: "127.0.0.1",
    });
    expect(result.ok).toBe(false);
  });

  it("rate limits repeated failed attempts", async () => {
    const ip = "10.0.0.1";
    let lastResult: Awaited<ReturnType<typeof authenticateAdmin>> = { ok: true };
    for (let i = 0; i < 9; i++) {
      lastResult = await authenticateAdmin({ username: "admin", password: "wrong", ip });
    }
    expect(lastResult.ok).toBe(false);
    expect(lastResult.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("admin session cookies", () => {
  beforeEach(() => cookieJar.clear());

  it("creates an HTTP-only session cookie", async () => {
    await createAdminSession("admin");
    expect(cookieJar.has(ADMIN_SESSION_COOKIE)).toBe(true);
    expect(cookieJar.get(ADMIN_SESSION_COOKIE)).toContain(".");
  });

  it("returns the session for a valid cookie", async () => {
    await createAdminSession("admin");
    const session = await getAdminSession();
    expect(session).not.toBeNull();
    expect(session?.username).toBe("admin");
  });

  it("returns null when no cookie exists", async () => {
    expect(await getAdminSession()).toBeNull();
  });

  it("returns null for a tampered cookie", async () => {
    cookieJar.set(ADMIN_SESSION_COOKIE, "tampered.token.value");
    expect(await getAdminSession()).toBeNull();
  });

  it("clears the session on logout", async () => {
    await createAdminSession("admin");
    await destroyAdminSession();
    expect(cookieJar.has(ADMIN_SESSION_COOKIE)).toBe(false);
    expect(await getAdminSession()).toBeNull();
  });
});
