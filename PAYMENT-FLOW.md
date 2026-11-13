# Payment Flow

## Renewal payment lifecycle

```
Client website (server)            CodeWizard API                 Razorpay
        │                                │                           │
        │  POST /api/license/verify      │                           │
        │ ─────────────────────────────► │  signed license payload    │
        │ ◄───────────────────────────── │                           │
        │                                │                           │
        │  (suspended)                   │                           │
        │  POST create-order             │                           │
        │ ─────────────────────────────► │  create order (server)    │
        │                                │ ─────────────────────────► │
        │                                │ ◄───────────────────────── │
        │ ◄───────────────────────────── │  order_id + amount        │
        │                                │                           │
        │  open Razorpay Checkout ──────────────────────────────────► │
        │ ◄────────────────────────────────────────────────────────── │
        │  (customer pays)               │                           │
        │                                │  webhook payment.captured │
        │                                │ ◄───────────────────────── │
        │                                │  verify signature + amount│
        │                                │  process renewal (RPC)    │
        │  POST renewal/verify           │                           │
        │ ─────────────────────────────► │  verify checkout signature│
        │                                │  fetch payment            │
        │                                │  process renewal (idemp.) │
        │ ◄───────────────────────────── │  license_valid + validity │
        │                                │                           │
        │  invalidate cache, website live                              │
```

---

## 1. Order creation

`POST /api/license/renewal/create-order`

- Authenticates the website with `public_id` + secret.
- Loads the **authoritative** amount from the active quote / AMC contract.
- Creates a Razorpay order server-side with `amount` in paise.
- Stores `razorpay_orders` and a `payments` row with status `created`.
- Returns `order_id`, `razorpay_key_id`, `amount_paise`, `currency`, `receipt`.

The amount is locked to the order. If the admin changes the price later, a new
order is required at the new price.

---

## 2. Checkout

The client website loads Razorpay Checkout (`checkout.js`) and opens it with:

```ts
new Razorpay({
  key: razorpay_key_id,
  amount: amount_paise,
  currency,
  name: "CodeWizard",
  description: `Renewal for ${website_name}`,
  order_id,
  handler: async (response) => {
    await verifyRenewalPayment({
      order_id: response.razorpay_order_id,
      payment_id: response.razorpay_payment_id,
      signature: response.razorpay_signature,
    });
  },
});
```

---

## 3. Payment verification

`POST /api/license/renewal/verify`

1. Verifies the checkout signature:
   `HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)`.
2. Fetches the payment from Razorpay and confirms `status === "captured"`.
3. Confirms the payment amount equals the stored order amount.
4. Confirms the order belongs to the authenticated website.
5. Calls the atomic renewal RPC.

**A frontend success callback alone never activates a license.**

---

## 4. Webhook processing

`POST /api/webhooks/razorpay`

- Signature verified against the **raw** request body:
  `HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)`.
- Event ID is stored in `razorpay_webhook_events` with a unique constraint —
  duplicates are ignored.
- `payment.captured`: verifies amount, then runs the same atomic renewal RPC.
- `payment.failed`: marks the order and payment failed.
- `refund.processed`: records a refund and updates the payment status.

The endpoint returns `200` even when processing fails, so Razorpay does not
retry indefinitely. Failures are logged and surfaced as admin notifications.

---

## 5. Atomic renewal RPC

`public.process_renewal_payment(...)` in `0003_renewal.sql`:

1. Locks the AMC contract row (`SELECT ... FOR UPDATE`).
2. Idempotency guard: if the payment is already `successful`, returns the
   existing period unchanged.
3. Computes the new period:
   - early renewal → start = `validity_end + 1 day`
   - late renewal → start = effective date
   - end = start + billing period − 1 day
4. Marks the payment `successful` and the order `paid`.
5. Inserts a new `amc_periods` row (history preserved).
6. Extends the contract validity and sets `access_status = active`.
7. Restores the website status to `live` if suspended.
8. Marks the quote `used`.

All steps run in one transaction.

---

## 6. Idempotency and duplicate handling

| Scenario | Behaviour |
| --- | --- |
| Duplicate webhook event | Ignored by unique `event_id` |
| Verify called twice for the same payment | RPC returns the existing period |
| Delayed webhook after verify | RPC guard prevents a second period |
| Payment amount mismatch | Rejected, webhook marked failed |
| Order for a different website | Rejected with 403 |
| Expired quote | New quote is used; old quote superseded on price change |

---

## 7. Failure handling

| Failure | Behaviour |
| --- | --- |
| Payment cancelled | Checkout dismiss callback; no state change |
| Payment failed | `payment.failed` webhook marks records failed |
| Razorpay unavailable at order time | `503` with a clear message; no license change |
| Razorpay unavailable at verify time | `502`; license unchanged |
| Invalid signature | `400`; logged |
| Amount mismatch | `400`; logged |
| Database failure | No license activation; transaction rolls back |

---

## 8. Reconciliation

**Admin → Transactions** shows, per order:

- Razorpay order ID and internal reference
- Linked internal payment and status
- Website and client
- Webhook event count
- Amount, currency, receipt
- Created timestamp

Use this page to compare Razorpay Dashboard settlements with internal records.
For exceptional cases, record a manual payment or manual renewal — every action
writes an immutable activity log entry.

---

## 9. Testing in Razorpay test mode

1. Set `RAZORPAY_ENABLED=true` with **test** keys.
2. Use Razorpay test cards / UPI test handles.
3. Create an order and pay with a test instrument.
4. Confirm the webhook (use a tunnel so Razorpay can reach your local app).
5. Verify the website becomes live and the AMC period is created.
6. Repeat with a failing instrument to confirm failed-state handling.

---

## 10. Important renewal rule

- If the website has an **active validity period** and renews early, validity
  extends from the existing `validity_end + 1 day`.
- If it has **already expired**, the new period starts from the agreed effective
  date.
- Never reset validity just because the client opened the payment page.
- Never create duplicate periods for the same payment.
