import { describe, it, expect } from "vitest";
import { signPayload, verifySignedPayload, hmacSha256, timingSafeEqual, randomToken } from "@/lib/signing";

const SECRET = "unit-test-secret-with-32-chars-min";

describe("signPayload / verifySignedPayload", () => {
  it("round-trips a payload", () => {
    const token = signPayload({ website_id: "abc", amount: 100 }, SECRET);
    const result = verifySignedPayload(token, SECRET);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.website_id).toBe("abc");
      expect(result.payload.amount).toBe(100);
    }
  });

  it("rejects tampered signatures", () => {
    const token = signPayload({ website_id: "abc" }, SECRET);
    const [body, signature] = token.split(".");
    const tampered = `${body}.${signature.slice(0, -2)}${signature.endsWith("aa") ? "bb" : "aa"}`;
    expect(verifySignedPayload(tampered, SECRET).valid).toBe(false);
  });

  it("rejects tokens signed with a different secret", () => {
    const token = signPayload({ website_id: "abc" }, "other-secret");
    expect(verifySignedPayload(token, SECRET).valid).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifySignedPayload("not-a-token", SECRET).valid).toBe(false);
    expect(verifySignedPayload("", SECRET).valid).toBe(false);
  });

  it("rejects expired tokens", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signPayload({ website_id: "abc", exp: now - 10 }, SECRET);
    const result = verifySignedPayload(token, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("expired");
  });

  it("accepts tokens that are not yet expired", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signPayload({ website_id: "abc", exp: now + 600 }, SECRET);
    expect(verifySignedPayload(token, SECRET).valid).toBe(true);
  });
});

describe("hmacSha256", () => {
  it("is deterministic", () => {
    expect(hmacSha256("data", SECRET)).toBe(hmacSha256("data", SECRET));
  });

  it("changes with the secret", () => {
    expect(hmacSha256("data", SECRET)).not.toBe(hmacSha256("data", "other-secret"));
  });
});

describe("timingSafeEqual", () => {
  it("compares equal strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("randomToken", () => {
  it("generates unique values", () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});
