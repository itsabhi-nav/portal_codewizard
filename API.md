# API Reference

All responses use a consistent envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "message": "...", "details": null } }
```

- Admin endpoints require a valid session cookie (`codewizard_admin_session`).
- License endpoints require website credentials (`public_id` + secret).
- The cron endpoint requires `CRON_SECRET`.
- The Razorpay webhook requires a valid webhook signature.

---

## Authentication

### `POST /api/auth/login`

```json
{ "username": "admin", "password": "•••" }
```

Returns `{ username }` and sets an HTTP-only session cookie. Rate limited.

### `POST /api/auth/logout`

Clears the session cookie.

### `GET /api/auth/me`

Returns the current admin session or `401`.

---

## Admin APIs

### Clients

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/clients?search=&page=&pageSize=&archived=` | List clients |
| POST | `/api/admin/clients` | Create client |
| GET | `/api/admin/clients/:id` | Client detail + websites (charges), payments, summary |
| PATCH | `/api/admin/clients/:id` | Update client |
| DELETE | `/api/admin/clients/:id` | Archive (soft) or delete if no financial records |

### Websites

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/websites?search=&status=&clientId=` | List websites |
| POST | `/api/admin/websites` | Create website with charges + provision license credential |
| GET | `/api/admin/websites/:id` | Full detail (all tabs) |
| PATCH | `/api/admin/websites/:id` | Update website |
| DELETE | `/api/admin/websites/:id` | Archive website |
| POST | `/api/admin/websites/:id/domain` | Add/change domain (history preserved) |
| POST | `/api/admin/websites/:id/suspend` | Manual suspension |
| POST | `/api/admin/websites/:id/reactivate` | Manual reactivation |
| POST | `/api/admin/websites/:id/exempt` | Toggle AMC exemption |

### AMC

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/websites/:id/amc` | Contract, periods, quotes |
| POST | `/api/admin/websites/:id/amc` | Configure AMC |
| POST | `/api/admin/websites/:id/amc/extend` | Manual validity extension |
| GET | `/api/admin/amc/:websiteId/quote` | List quotes |
| POST | `/api/admin/amc/:websiteId/quote` | Create one-time / permanent price quote |
| POST | `/api/admin/amc/:websiteId/renew` | Record manual renewal (creates payment + period) |

### License credentials

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/websites/:id/license` | Credential metadata (no secret) |
| POST | `/api/admin/websites/:id/license` | Rotate secret (returns secret once) |

### Payments

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/payments?search=&status=&purpose=&method=&dateFrom=&dateTo=` | List |
| POST | `/api/admin/payments` | Record payment (auto-creates the matching paid invoice) |
| GET | `/api/admin/payments/:id` | Detail + refunds |
| PATCH | `/api/admin/payments/:id` | Update payment |
| POST | `/api/admin/payments/:id` | Record refund (body: `refundCreateSchema`) |
| GET | `/api/admin/payments/:id/receipt` | PDF receipt |

### Invoices

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/invoices?search=&status=&type=` | List |
| POST | `/api/admin/invoices` | Create invoice with line items |
| GET | `/api/admin/invoices/:id` | Detail + items |
| PATCH | `/api/admin/invoices/:id` | Update status / due date |
| GET | `/api/admin/invoices/:id/pdf` | PDF invoice |

### Dashboard / transactions / activity

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/dashboard?dateFrom=&dateTo=` | Metrics + charts |
| GET | `/api/admin/transactions?status=&websiteId=` | Razorpay reconciliation |
| GET | `/api/admin/activity?eventType=&clientId=&websiteId=&search=` | Activity logs |

### Settings / notifications / cron / export / search

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/settings` | Settings + system config status |
| PUT | `/api/admin/settings` | Update settings |
| GET | `/api/admin/settings/templates` | List WhatsApp templates |
| PUT | `/api/admin/settings/templates` | Bulk update templates |
| GET | `/api/admin/notifications` | Admin notifications + unread count |
| PATCH | `/api/admin/notifications` | Mark read (`{ id }` or `{ all: true }`) |
| GET | `/api/admin/cron/logs` | Cron execution history |
| POST | `/api/admin/cron/run` | Manual AMC check (admin) |
| GET | `/api/admin/export?resource=clients\|websites\|payments\|invoices\|amc\|renewals\|revenue` | CSV export |
| GET | `/api/admin/search?q=` | Global search |

---

## Public license API

### `POST /api/license/verify`

Request:

```json
{ "public_id": "cw_abc123", "secret": "cws_•••" }
```

or `Authorization: Bearer <secret>` with `{ "public_id": "..." }`.

Response:

```json
{
  "success": true,
  "data": {
    "token": "<signed token>",
    "payload": {
      "website_id": "uuid",
      "public_id": "cw_abc123",
      "client_id": "uuid",
      "website_name": "Acme Site",
      "status": "upcoming",
      "access_status": "active",
      "license_valid": true,
      "validity_start": "2025-06-01",
      "validity_end": "2026-05-31",
      "renewal_amount_paise": 250000,
      "currency": "INR",
      "renewal_quote_id": "uuid",
      "suspension": { "heading": "...", "description": "...", "...": "..." },
      "issued_at": 1735689600,
      "expires_at": 1735776000
    },
    "cached": false
  }
}
```

### `GET /api/license/config?public_id=&secret=`

Same payload plus `suspension`, `renewal_amount_paise`, `currency`. Usable while
suspended so the renewal screen can render.

### `POST /api/license/renewal/create-order`

Request: website credentials. Response:

```json
{
  "order_id": "order_...",
  "internal_order_ref": "ord_...",
  "amount_paise": 250000,
  "currency": "INR",
  "razorpay_key_id": "rzp_test_...",
  "receipt": "renew_...",
  "quote_id": "uuid",
  "website_name": "Acme Site"
}
```

The amount is always authoritative from the database. Client-submitted amounts
are ignored.

### `POST /api/license/renewal/verify`

Request:

```json
{
  "public_id": "cw_abc123",
  "secret": "cws_•••",
  "order_id": "order_...",
  "payment_id": "pay_...",
  "signature": "..."
}
```

Verifies the checkout signature, fetches the payment from Razorpay, checks the
amount, then atomically creates the AMC period and restores access.

Response:

```json
{ "verified": true, "license_valid": true, "validity_end": "2027-05-31", "payment_id": "pay_...", "order_id": "order_..." }
```

### `POST /api/webhooks/razorpay`

Razorpay webhook receiver. Requires `x-razorpay-signature` validated against the
raw body. Handles `payment.captured`, `payment.failed`, `refund.processed`.
Idempotent by `event_id`.

### `POST /api/cron/amc-check`

Requires `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`. Runs the
daily AMC check. Response includes counts and errors.

### `GET /api/health`

Public health probe. Reports config/database/Razorpay/license status without
leaking secrets.
