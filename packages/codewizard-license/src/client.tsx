"use client";

import { useCallback, useEffect, useState } from "react";
import type { LicensePayload, RenewalOrder } from "./types";

/**
 * Client-side helpers for the renewal flow.
 *
 * These call the CLIENT website's own local API routes, which proxy to the
 * central CodeWizard license API using the server-side secret. The secret is
 * never exposed to the browser.
 */

export interface LocalLicenseConfig {
  payload: LicensePayload;
  renewal_amount_paise: number;
  currency: string;
  suspension: LicensePayload["suspension"];
}

export function useLicenseConfig() {
  const [config, setConfig] = useState<LocalLicenseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/codewizard/license", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) {
        setError(json?.error?.message ?? "Unable to load license configuration");
        return;
      }
      setConfig(json.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { config, loading, error, reload: load };
}

export async function createRenewalOrder(): Promise<RenewalOrder> {
  const response = await fetch("/api/codewizard/license/renewal/create-order", { method: "POST" });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json?.error?.message ?? "Failed to create payment order");
  }
  return json.data as RenewalOrder;
}

export async function verifyRenewalPayment(params: {
  order_id: string;
  payment_id: string;
  signature: string;
}): Promise<{ verified: boolean; license_valid: boolean; validity_end: string | null }> {
  const response = await fetch("/api/codewizard/license/renewal/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json?.error?.message ?? "Payment verification failed");
  }
  return json.data;
}

interface RazorpayCheckoutOptions {
  order: RenewalOrder;
  websiteName: string;
  onSuccess: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onFailure?: (error: { description?: string }) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay Checkout"));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Razorpay Checkout unavailable");

  const razorpay = new window.Razorpay({
    key: options.order.razorpay_key_id,
    amount: options.order.amount_paise,
    currency: options.order.currency,
    name: "CodeWizard",
    description: `Renewal for ${options.websiteName}`,
    order_id: options.order.order_id,
    handler: options.onSuccess,
    modal: { ondismiss: () => options.onFailure?.({ description: "Payment cancelled" }) },
    theme: { color: "#2563eb" },
  });

  razorpay.open();
}
