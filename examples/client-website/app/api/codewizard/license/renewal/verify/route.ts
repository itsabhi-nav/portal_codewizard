import { NextResponse } from "next/server";
import { getLicenseConfig } from "@codewizard/license/config";

export const dynamic = "force-dynamic";

/** Verifies a Razorpay Checkout callback with CodeWizard. */
export async function POST(request: Request) {
  const config = getLicenseConfig();
  const body = await request.json();

  const response = await fetch(`${config.apiUrl}/api/license/renewal/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      public_id: config.websiteId,
      secret: config.websiteSecret,
      order_id: body.order_id,
      payment_id: body.payment_id,
      signature: body.signature,
    }),
    cache: "no-store",
  });

  const json = await response.json();
  return NextResponse.json(json, { status: response.status });
}
