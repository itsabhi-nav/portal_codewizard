import { NextResponse } from "next/server";
import { getLicenseConfig } from "@codewizard/license/config";

export const dynamic = "force-dynamic";

/** Creates a Razorpay order using CodeWizard's authoritative amount. */
export async function POST() {
  const config = getLicenseConfig();
  const response = await fetch(`${config.apiUrl}/api/license/renewal/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      public_id: config.websiteId,
      secret: config.websiteSecret,
    }),
    cache: "no-store",
  });

  const json = await response.json();
  return NextResponse.json(json, { status: response.status });
}
