"use client";

import { useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw, Mail, Phone } from "lucide-react";
import { useLicenseConfig, createRenewalOrder, openRazorpayCheckout, verifyRenewalPayment } from "../client";

/**
 * Full-page suspension / renewal screen.
 *
 * Render this on the renewal route. It:
 * 1. Fetches the latest signed configuration from the client's local proxy.
 * 2. Displays the configured heading, description, price and support details.
 * 3. Opens Razorpay Checkout and verifies the payment server-side.
 * 4. Reloads the page after successful verification so the site becomes
 *    accessible again.
 *
 * All copy is configurable from the CodeWizard admin portal.
 */
export function LicenseSuspended() {
  const { config, loading, error, reload } = useLicenseConfig();
  const [paymentState, setPaymentState] = useState<"idle" | "creating" | "verifying" | "success" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const suspension = config?.suspension ?? null;
  const amountPaise = config?.renewal_amount_paise ?? 0;

  async function handlePay() {
    setPaymentState("creating");
    setErrorMessage(null);
    try {
      const order = await createRenewalOrder();
      await openRazorpayCheckout({
        order,
        websiteName: config?.payload.website_name ?? "your website",
        onSuccess: async (response) => {
          setPaymentState("verifying");
          try {
            const result = await verifyRenewalPayment({
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            if (result.verified && result.license_valid) {
              setPaymentState("success");
              setTimeout(() => window.location.reload(), 1200);
            } else {
              setPaymentState("failed");
              setErrorMessage("Payment could not be verified. Please contact support.");
            }
          } catch (verifyError) {
            setPaymentState("failed");
            setErrorMessage(verifyError instanceof Error ? verifyError.message : "Payment verification failed");
          }
        },
        onFailure: () => {
          setPaymentState("failed");
          setErrorMessage("Payment was cancelled.");
        },
      });
    } catch (orderError) {
      setPaymentState("failed");
      setErrorMessage(orderError instanceof Error ? orderError.message : "Unable to start payment");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-semibold">{suspension?.heading ?? "Website Temporarily Unavailable"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ?? suspension?.description ?? "Please try again later."}
          </p>
          <button
            onClick={reload}
            className="mt-6 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: suspension?.background ?? "#0b1220", color: suspension?.textColor ?? "#ffffff" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg text-center">
        {suspension?.logoUrl ? (
          <img src={suspension.logoUrl} alt="Logo" className="mx-auto mb-6 h-14 w-auto" />
        ) : (
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-violet-500 shadow-xl shadow-blue-500/20">
            <AlertTriangle className="h-8 w-8 text-white" />
          </div>
        )}

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {suspension?.heading ?? "Website Temporarily Unavailable"}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed opacity-80 sm:text-base">
          {suspension?.description ??
            "Your annual website maintenance service has expired. Please complete the renewal payment to restore access."}
        </p>

        <div className="mt-8">
          <p className="text-xs uppercase tracking-widest opacity-60">Renewal Amount</p>
          <p className="mt-1 text-3xl font-semibold">
            {new Intl.NumberFormat("en-IN", { style: "currency", currency: config.currency }).format(amountPaise / 100)}
          </p>
          {config.payload.validity_end && (
            <p className="mt-1 text-xs opacity-60">Current validity ended {config.payload.validity_end}</p>
          )}
        </div>

        <button
          onClick={handlePay}
          disabled={paymentState === "creating" || paymentState === "verifying" || paymentState === "success"}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-60 sm:w-auto"
          style={{ background: suspension?.buttonColor ?? "#2563eb" }}
        >
          {paymentState === "creating" && <Loader2 className="h-4 w-4 animate-spin" />}
          {paymentState === "verifying" && <Loader2 className="h-4 w-4 animate-spin" />}
          {paymentState === "success" ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Payment verified — restoring access…
            </>
          ) : paymentState === "verifying" ? (
            "Verifying payment…"
          ) : (
            suspension?.buttonText ?? "Pay Now"
          )}
        </button>

        {paymentState === "failed" && errorMessage && (
          <p className="mt-4 text-sm text-rose-300">{errorMessage}</p>
        )}

        {suspension?.showSupport !== false && (
          <div className="mt-10 border-t border-white/10 pt-6 text-sm opacity-80">
            <p>{suspension?.supportText ?? "Please contact your website administrator if you need assistance."}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
              {suspension?.supportEmail && (
                <a href={`mailto:${suspension.supportEmail}`} className="flex items-center gap-1.5 hover:opacity-100">
                  <Mail className="h-4 w-4" /> {suspension.supportEmail}
                </a>
              )}
              {suspension?.supportPhone && (
                <a href={`tel:${suspension.supportPhone}`} className="flex items-center gap-1.5 hover:opacity-100">
                  <Phone className="h-4 w-4" /> {suspension.supportPhone}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
