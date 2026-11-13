import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The websites list now lives inside the merged "Clients & Websites" page. */
export default function WebsitesPage() {
  redirect("/admin/clients");
}
