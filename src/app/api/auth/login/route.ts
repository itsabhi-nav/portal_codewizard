import { z } from "zod";
import { authenticateAdmin, createAdminSession } from "@/lib/auth";
import { checkCsrf, fail, ok, parseJsonBody, requestMeta, tooManyRequests } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(200),
});

export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const body = await parseJsonBody(request, loginSchema);
  if (!body.success) return body.response;

  const result = await authenticateAdmin({
    username: body.data.username,
    password: body.data.password,
    ip: requestMeta(request).ip,
  });

  if (!result.ok) {
    if (result.retryAfterSeconds) {
      return tooManyRequests(result.error ?? "Too many requests", result.retryAfterSeconds);
    }
    return fail(401, result.error ?? "Invalid username or password");
  }

  await createAdminSession(body.data.username);
  return ok({ username: body.data.username });
}
