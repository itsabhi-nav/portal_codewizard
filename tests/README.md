# Tests

Run the suite:

```bash
npm test              # one-shot
npm run test:watch    # watch mode
```

The suite runs in a Node environment with test-only environment variables
configured in `vitest.config.ts`. No database or network access is required.

## Coverage

| File | Area |
| --- | --- |
| `amc.test.ts` | AMC status rules, renewal period math, quote pricing |
| `money.test.ts` | Integer-paise arithmetic and INR formatting |
| `signing.test.ts` | HMAC signing, tamper rejection, expiry |
| `whatsapp.test.ts` | Phone normalization, wa.me links, template interpolation |
| `auth.test.ts` | Login success/failure, rate limiting, session cookies |
| `license.test.ts` | License payload, per-site copy overrides, signed tokens, credential-bound cache |
| `license-client-verification.test.ts` | Client integration rechecks status with the default zero cache TTL |
| `license-middleware.test.ts` | Suspended-site redirect and renewal-path access |

## Sample test scenarios

### AMC calculation

1. Active website (31 days remaining) → `active`.
2. Website with 10 days remaining and threshold 10 → `upcoming`.
3. Website on its final valid day → still valid (`upcoming`).
4. Website one day past validity end → `overdue` (within grace).
5. Website 5 days past validity end with 3-day grace → `suspended`.
6. Exempt website → `exempt`, regardless of dates.
7. AMC disabled → `disabled`.
8. Leap day: `2024-02-29` final day, `2024-03-01` overdue.
9. Month boundary: `2026-01-31` final day, `2026-02-01` overdue.
10. Early renewal: new period starts `validity_end + 1 day`.
11. Late renewal: new period starts on the effective date.
12. Manual extension: new end = supplied date.

### Payments

1. Successful payment → invoice marked paid, license extended.
2. Failed payment → no license change.
3. Invalid checkout signature → rejected.
4. Duplicate webhook event → ignored (`event_id` unique).
5. Delayed webhook after verify → RPC idempotency guard prevents a second period.
6. Incorrect amount → rejected.
7. Payment linked to the wrong website → rejected (403).
8. Refund → separate immutable refund record, payment status updated.

### Authentication

1. Correct admin credentials → session cookie set.
2. Incorrect password → `401` with a generic message.
3. Unauthorized dashboard access → redirect to `/login`.
4. Session expiration → expired token rejected.
5. Logout → cookie cleared.
6. Login rate limiting → blocked after repeated failures.

### License

1. Active website → `license_valid: true`.
2. Expired website → `license_valid: false`, renewal screen config returned.
3. Suspended website → `license_valid: false`.
4. Manual override (manual_suspended) → distinct access status.
5. Signed response validation → valid signature accepted.
6. Invalid signature → rejected.
7. A wrong secret after a successful check is still rejected.
8. Default server and middleware behavior rechecks status instead of serving stale active results.
9. Opt-in cache expiration → fresh verification after TTL.
10. License API outage → bounded offline grace, never treats outage as expiry.

## Manual end-to-end checklist

1. Start the app and log in.
2. Create a client with a mobile + WhatsApp number.
3. Create two websites under the client.
4. Add/update a domain.
5. Record development charges and an advance.
6. Verify the outstanding balance on the client page.
7. Configure AMC independently for each website with different prices.
8. Change a renewal amount after expiry — no redeployment.
9. Confirm the website appears under **AMC & Renewals → Upcoming**.
10. Run the cron manually (Settings → System Health → Run AMC Check Now).
11. Confirm the website is suspended after the grace period.
12. Integrate a client website and confirm the full-page renewal screen.
13. Pay in Razorpay test mode and confirm automatic reactivation.
14. Send a pre-filled WhatsApp reminder.
15. Change the renewal screen wording and confirm it appears without redeploy.
16. Export clients/payments/AMC to CSV.
17. Generate and download an invoice PDF.
18. Check activity logs and cron/webhook health.
