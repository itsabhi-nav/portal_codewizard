import crypto from "node:crypto";

/**
 * HMAC-SHA256 signing for license responses and admin sessions.
 * Secrets are only ever read on the server.
 */

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function hmacSha256(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Sign a JSON payload. Returns `${base64url(payload)}.${signature}`. */
export function signPayload(payload: Record<string, unknown>, secret: string): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacSha256(body, secret);
  return `${body}.${signature}`;
}

export function verifySignedPayload<T = Record<string, unknown>>(
  token: string,
  secret: string
): { valid: true; payload: T } | { valid: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed token" };
  }
  const [body, signature] = parts;
  const expected = hmacSha256(body, secret);
  if (!timingSafeEqual(signature, expected)) {
    return { valid: false, error: "Invalid signature" };
  }
  try {
    const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as T & {
      exp?: number;
      expires_at?: number;
      iat?: number;
    };
    const expiry = payload.exp ?? payload.expires_at;
    if (expiry && Math.floor(Date.now() / 1000) > expiry) {
      return { valid: false, error: "Token expired" };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: "Invalid payload" };
  }
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function randomSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
