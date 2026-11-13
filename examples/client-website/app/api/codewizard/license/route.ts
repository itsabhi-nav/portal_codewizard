import { NextResponse } from "next/server";
import { verifyLicense } from "@codewizard/license/server";

export const dynamic = "force-dynamic";

/**
 * Local proxy used by <LicenseSuspended />. The website secret stays on the
 * server; the browser only receives the signed configuration.
 */
export async function GET() {
  const result = await verifyLicense();
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { message: result.error ?? "License unavailable" } },
      { status: 503 }
    );
  }

  const { payload } = result.verification!;
  return NextResponse.json({
    success: true,
    data: {
      payload,
      renewal_amount_paise: payload.renewal_amount_paise,
      currency: payload.currency,
      suspension: payload.suspension,
    },
  });
}
