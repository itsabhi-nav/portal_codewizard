import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getAdminSession().catch(() => null);
  redirect(session ? "/admin/dashboard" : "/login");
}
