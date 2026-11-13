import crypto from "node:crypto";
import Razorpay from "razorpay";
import { config } from "@/lib/config";
import { timingSafeEqual } from "@/lib/signing";

/**
 * Razorpay integration helpers.
 *
 * Orders are always created server-side with the authoritative amount from the
 * database. Client-submitted amounts are never trusted. Payment signatures and
 * webhook signatures are verified with HMAC against the raw request body.
 */

let razorpayClient: Razorpay | null = null;

export function isRazorpayAvailable(): boolean {
  return config.razorpay.enabled && Boolean(config.razorpay.keyId && config.razorpay.keySecret);
}

export function getRazorpay(): Razorpay {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment. See PAYMENT-FLOW.md."
    );
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return razorpayClient;
}

export interface RazorpayOrderResult {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
  created_at: number;
  notes?: Record<string, string>;
}

export interface CreateOrderInput {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export async function createRazorpayOrder(input: CreateOrderInput): Promise<RazorpayOrderResult> {
  const client = getRazorpay();
  const order = await client.orders.create({
    amount: Math.round(input.amountPaise),
    currency: input.currency || "INR",
    receipt: input.receipt,
    notes: input.notes ?? {},
  });
  return order as unknown as RazorpayOrderResult;
}

export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrderResult> {
  const client = getRazorpay();
  const order = await client.orders.fetch(orderId);
  return order as unknown as RazorpayOrderResult;
}

export interface RazorpayPaymentResult {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  method: string;
  email?: string;
  contact?: string;
  created_at: number;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPaymentResult> {
  const client = getRazorpay();
  const payment = await client.payments.fetch(paymentId);
  return payment as unknown as RazorpayPaymentResult;
}

export async function createRazorpayRefund(paymentId: string, amountPaise: number): Promise<unknown> {
  const client = getRazorpay();
  return await client.payments.refund(paymentId, { amount: Math.round(amountPaise) });
}

/** Verify the checkout signature returned by Razorpay Checkout. */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!config.razorpay.keySecret) return false;
  const expected = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("base64");
  return timingSafeEqual(expected, signature);
}

/** Verify a Razorpay webhook signature against the RAW request body. */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
  if (!config.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac("sha256", config.razorpay.webhookSecret)
    .update(rawBody)
    .digest("base64");
  return timingSafeEqual(expected, signature);
}
