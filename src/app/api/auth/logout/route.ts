import { destroyAdminSession } from "@/lib/auth";
import { ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await destroyAdminSession();
  return ok({ loggedOut: true });
}
