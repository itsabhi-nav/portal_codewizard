import { getAdminSession } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  return ok({
    username: session.username,
    expiresAt: session.expiresAt,
  });
}
