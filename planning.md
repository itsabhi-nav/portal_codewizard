# MASTER BUILD PROMPT — CODEWIZARD AGENCY MANAGEMENT & AMC PLATFORM

Act as a senior full-stack architect, senior Next.js engineer, database architect, UI/UX designer, payment integration specialist and security engineer.

I want you to build a complete, production-ready application named **CodeWizard Agency Management Portal** from scratch.

This is not a demo, landing page or static dashboard. Build the actual frontend, backend, database integration, payment workflows, scheduled jobs, website licensing system and reusable integration for my other websites.

Do not stop after creating the UI. Implement every module end-to-end, with proper database persistence, validation, error handling and testing.

If credentials are not available, use environment-variable placeholders and provide a clear setup guide. Never fabricate successful payment responses or pretend integrations are configured.

---

# 1. PROJECT OVERVIEW

CodeWizard is a web development agency. I develop websites for clients, primarily using Next.js.

I need an internal agency management platform that lets me:

1. Manage all clients.
2. Manage multiple websites belonging to each client.
3. Track development charges and payments.
4. Track advance payments and outstanding balances.
5. Configure individual annual maintenance charges (AMC).
6. Automatically track website validity and expiry.
7. Automatically suspend expired websites after a configurable grace period.
8. Display a full-page renewal screen on suspended client websites.
9. Accept renewal payments through Razorpay.
10. Automatically reactivate websites after successful payment verification.
11. Change renewal prices and negotiate different amounts with individual clients without redeploying their websites.
12. Send clients WhatsApp renewal reminders using pre-filled messages.
13. Monitor all business revenue, upcoming renewals and outstanding payments from one dashboard.

## Architectural principle

Build ONE Next.js application and ONE GitHub repository.

The application contains two logical parts:

- Admin Portal: The interface I use to manage my agency.
- License Engine: Backend services that control the licensing and access status of my client websites.

These are NOT separate applications.

All data must be stored centrally in Supabase PostgreSQL.

My client websites will remain separate Next.js deployments but will communicate with the central CodeWizard licensing backend.

---

# 2. TECHNOLOGY STACK

Use the following stack:

- Next.js (latest stable version compatible with the environment)
- React
- TypeScript (strict mode)
- Tailwind CSS
- shadcn/ui
- Supabase PostgreSQL
- Supabase server-side integration
- Supabase Auth only if needed for future migration; initial admin authentication must use environment-configured credentials
- Razorpay Checkout and Orders API
- Razorpay Webhooks
- Supabase Cron or a secure external scheduler
- Zod for validation
- Recharts for dashboard charts
- Lucide icons
- React Hook Form where appropriate

Use the Next.js App Router.

Use server components by default. Use client components only where interaction requires them.

Do not introduce unnecessary microservices.

The application should be deployable on Netlify with compatible Next.js server-side and edge capabilities.

If a feature requires a Netlify-specific implementation, use the supported approach and document it.

---

# 3. ENVIRONMENT CONFIGURATION

Create a complete `.env.example`.

Use these variables as the initial configuration structure:

```env
# Application
NEXT_PUBLIC_APP_NAME=CodeWizard
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
APP_TIMEZONE=Asia/Kolkata
NODE_ENV=development

# Admin Authentication
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Scheduled Jobs
CRON_SECRET=

# License Engine
LICENSE_CACHE_TTL=3600
LICENSE_SIGNING_SECRET=

# Optional Notifications
WHATSAPP_BASE_URL=https://wa.me/
SUPPORT_EMAIL=
SUPPORT_PHONE=
```

Requirements:

- Never expose admin credentials to the browser.
- Never expose the Supabase service role key to the browser.
- Never expose Razorpay secret keys to the browser.
- Never expose the license signing secret.
- Never commit `.env` to Git.
- Create `.env.example` with empty placeholders.
- Validate all required configuration at startup or at the point where a feature needs it.
- Provide useful error messages when credentials are missing.

The admin login should use the configured username and password.

Initially, support one administrator.

Do not build public registration or public admin account creation.

Implement:

- Secure password comparison.
- HTTP-only session cookies.
- Secure cookies in production.
- SameSite protection.
- CSRF protection where applicable.
- Login rate limiting.
- Session expiration.
- Logout.
- Protection for all admin routes and APIs.

Prefer a robust password hashing approach even if the initial password comes from `.env`. Do not store plaintext admin credentials in the database.

Document that changing environment-based credentials requires redeployment/restart.

---

# 4. APPLICATION DESIGN

Build a premium, professional SaaS-style agency dashboard.

Brand: CodeWizard.

Visual direction:

- Deep navy backgrounds.
- Electric blue accents.
- Cyan highlights.
- Subtle purple gradients.
- Modern typography.
- Clean cards and tables.
- Professional charts.
- Subtle animations.
- Consistent spacing.
- Beautiful empty states.
- Excellent responsive behaviour.

Support:

- Dark theme.
- Light theme.
- Theme preference persistence.
- Desktop sidebar.
- Collapsible sidebar.
- Mobile navigation.
- Responsive tables.
- Mobile-friendly forms and dialogs.

Do not make it look like an outdated Bootstrap admin panel.

The interface should feel like a polished commercial SaaS product.

Use proper loading skeletons, toast notifications, confirmation dialogs and error states.

Avoid placeholder buttons that do nothing.

---

# 5. APPLICATION NAVIGATION

Create the following sidebar navigation:

1. Dashboard
2. Clients
3. Websites
4. Projects
5. Payments & Finance
6. Invoices
7. AMC & Renewals
8. Transactions
9. Activity Logs
10. Settings

Add a top navigation bar with:

- Search.
- Notifications.
- Current admin profile.
- Theme toggle.
- Logout.

---

# 6. DASHBOARD

Build a comprehensive business overview.

Display the following metrics:

- Total clients.
- Total websites.
- Active websites.
- Upcoming renewals.
- Expired websites.
- Suspended websites.
- Total development revenue.
- Total AMC revenue.
- Total money received.
- Total outstanding development payments.
- Upcoming AMC revenue.
- Total refunds.

Distinguish between:

1. Money already collected.
2. Money still outstanding.
3. Potential future AMC revenue.

Do not count pending invoices as collected revenue.

Add charts:

- Monthly revenue.
- Development revenue versus AMC revenue.
- Website status distribution.
- Upcoming AMC renewals.
- Payment collection trends.

Add a recent activity section.

Add a quick-action section:

- Add client.
- Add website.
- Record payment.
- Create invoice.
- Configure AMC.

All dashboard metrics must come from real database queries.

Do not hardcode demo statistics.

Provide filters for date range and revenue type.

---

# 7. CLIENT MANAGEMENT

Create a complete client management module.

Each client should have:

- Unique client ID.
- Client name.
- Business/organization name.
- Contact person.
- Mobile number.
- Separate WhatsApp number (optional).
- Email address (optional).
- Address (optional).
- City.
- State.
- PIN code.
- Internal notes.
- Created date.
- Updated date.

Mobile number should be stored in a normalized format with country code.

The client mobile number should be reusable across all websites belonging to that client.

One client can own multiple websites.

Provide:

- Add client.
- Edit client.
- View client.
- Search clients.
- Delete/archive client with appropriate safeguards.
- View all websites belonging to a client.
- View total development charges.
- View total payments.
- View outstanding balance.
- View AMC history.
- View transaction history.
- View activity timeline.

Do not hard-delete clients who have financial records.

Use soft deletion or archival.

---

# 8. WEBSITE MANAGEMENT

Each website must have a unique permanent UUID.

A website record should contain:

- Website ID.
- Website name.
- Client ID.
- Domain name (optional).
- Additional domains/aliases (optional).
- Deployment URL (optional).
- Website description.
- Project start date.
- Go-live date.
- Development cost.
- Website status.
- Hosting provider.
- Internal notes.
- Created date.
- Updated date.

The domain field must be optional.

When a domain exists, show it as a clickable link that opens the website in a new tab.

Do not use the domain as the permanent identifier. Domains can change.

Support multiple websites for one client.

Support domain changes while preserving domain history.

Website statuses:

- Development.
- Testing.
- Live.
- Suspended.
- Archived.

AMC should be independently configurable for every website.

Add a website detail page with tabs:

1. Overview.
2. Project & Development.
3. Payments.
4. AMC & Validity.
5. Transactions.
6. License Configuration.
7. Activity History.

Provide actions:

- Edit website.
- Update domain.
- Change go-live date.
- Enable/disable AMC.
- Extend AMC validity.
- Change AMC price.
- Suspend website.
- Reactivate website.
- Exempt website from AMC.
- View renewal history.

Manual suspension must be distinguishable from automatic AMC suspension.

---

# 9. PROJECT AND DEVELOPMENT MANAGEMENT

Every website can have a development project.

Project fields:

- Project ID.
- Client ID.
- Website ID.
- Project name.
- Project description.
- Agreed development cost.
- Advance amount.
- Project start date.
- Expected completion date.
- Actual delivery date.
- Go-live date.
- Project status.
- Notes.

Project statuses:

- Not started.
- In progress.
- Testing.
- Delivered.
- Completed.
- Cancelled.

Support milestone tracking as an optional feature.

Development payment and AMC payments must be tracked independently.

---

# 10. FINANCIAL MANAGEMENT

Create a proper financial tracking system.

For every project, track:

- Total agreed development amount.
- Total successful payments.
- Remaining development balance.
- Refunds.
- Additional charges.

Formula:

Remaining development balance =
Agreed development amount
+ Additional charges
- Successful development payments
+ Applicable outstanding adjustments.

Do not calculate the balance from a manually editable number.

Use actual invoices, line items, payment records and refunds.

Support payment methods:

- Razorpay.
- UPI.
- Bank transfer.
- Cash.
- Other/manual.

Each payment must have:

- Unique payment record ID.
- Client ID.
- Website ID.
- Invoice ID (where applicable).
- Amount in integer paise.
- Currency.
- Payment method.
- Payment purpose.
- Payment status.
- Transaction reference.
- Payment date.
- Notes.

Payment purposes:

- Development.
- AMC renewal.
- Additional development.
- Hosting.
- Other services.

Payment statuses:

- Created.
- Pending.
- Successful.
- Failed.
- Refunded.
- Partially refunded.

Use immutable financial records wherever practical.

Never silently overwrite historical payment information.

Record adjustments and refunds as separate transactions.

All financial calculations must use integer paise, not JavaScript floating-point currency arithmetic.

Display amounts in INR using Indian number formatting.

---

# 11. INVOICE MANAGEMENT

Create an invoice module.

Support:

- Development invoices.
- AMC invoices.
- Additional service invoices.
- Partial payments.
- Fully paid invoices.
- Overdue invoices.
- Downloadable PDF invoices.
- Invoice numbering.
- Invoice dates.
- Due dates.
- Client details.
- Website details.
- Line items.
- Taxes, if configured.
- Payment status.

Provide an invoice preview.

Generate professional PDF invoices branded with CodeWizard.

Do not invent GST registration details or GST numbers.

GST should be configurable and disabled by default until the agency's actual tax details are supplied.

Allow downloading invoices and payment receipts.

---

# 12. AMC AND RENEWAL MANAGEMENT

This is the most important module.

AMC must be configured individually for each website.

Fields:

- AMC enabled/disabled.
- Original annual AMC price.
- Current renewal price.
- Negotiated renewal price (optional).
- Billing frequency.
- Go-live date.
- Validity start date.
- Validity end date.
- Upcoming threshold.
- Grace period.
- Renewal status.
- Auto-renewal option (future-ready).
- Current renewal quote.
- Last successful renewal date.
- Next expiry date.

Default billing period: 365 calendar days.

Support a configurable billing period if needed.

Use Asia/Kolkata for the business date and ensure expiry calculations are consistent.

Define the validity boundary explicitly:

- Validity start date is included.
- Validity end date is the final valid date.
- Expiry begins on the following calendar date.

Keep all historical AMC periods.

Never overwrite previous AMC periods when renewing.

### Status rules

Implement these statuses:

ACTIVE:
More than the configured upcoming threshold remains.

UPCOMING:
Remaining positive days are less than or equal to the configured upcoming threshold.

EXPIRED:
The validity end date has passed.

OVERDUE:
The website has expired and the grace period is still in effect.

SUSPENDED:
The grace period has ended and public access is restricted.

EXEMPT:
The admin has explicitly exempted the website from AMC.

DISABLED:
AMC is disabled for that website.

Default upcoming threshold: 10 days.

Default grace period: 3 calendar days.

Both must be configurable globally and per website.

Important: These are business states. Keep manual suspension as a separate access-control reason.

### Renewal logic

If a client renews before the existing validity expires:

New validity start = Existing validity end date + 1 day.

If a client renews after expiry:

New validity start = Agreed renewal effective date.

New validity end = New validity start + configured billing period - 1 day.

Do not reset validity simply because the client opens the payment page.

Only extend validity after server-side payment verification.

Support manual renewal and manual validity extension by the administrator.

---

# 13. NEGOTIABLE RENEWAL PRICING

This feature is essential.

I need to negotiate AMC prices individually with clients.

Example:

Original AMC: ₹3,000.

I negotiate with the client and reduce the renewal amount to ₹2,000.

I should be able to change the price from the admin portal without redeploying the client website.

Implement:

- Original AMC price.
- Default renewal price.
- Negotiated renewal price.
- Discount amount.
- Discount percentage (derived where appropriate).
- Negotiation reason.
- Admin notes.
- Effective date.
- Quote expiry date.
- Quote status.

The admin must be able to:

1. Change renewal amount.
2. Set a one-time discounted renewal price.
3. Set a permanent new annual AMC price.
4. Reset negotiated price to the default.
5. Change an existing pending renewal quote.
6. View all previous price changes.

Distinguish between:

- One-time renewal discount.
- Permanent annual AMC price change.

Do not change the original historical AMC amount when negotiating a new price.

The client renewal screen must always fetch the latest valid renewal quote from the backend.

A price update must not require redeployment.

When a Razorpay order is created, lock the amount associated with that order. If the quote changes afterward, create a new order using the new price.

Never trust a client-submitted amount.

---

# 14. DAILY AUTOMATED CRON JOB

Implement a daily scheduled job.

Default execution: 1:00 AM Asia/Kolkata.

The cron must run independently of client website traffic.

It must check all eligible AMC records.

For each website:

1. Determine the current business date.
2. Calculate remaining validity.
3. Calculate the current AMC status.
4. Detect upcoming renewals.
5. Detect expiry.
6. Detect the end of grace period.
7. Update the central website access status.
8. Create required activity events.
9. Create notification tasks.
10. Update the dashboard data.

The cron must be idempotent.

Running it multiple times must not produce duplicate events, duplicate reminders or duplicate suspension actions.

Use database transactions where appropriate.

Avoid processing every website in a single unbounded query. Use pagination/batching.

Add:

- Cron execution history.
- Last successful run.
- Last failed run.
- Number of websites processed.
- Number of upcoming websites.
- Number of expired websites.
- Number of newly suspended websites.
- Error logs.

Provide an admin-only manual cron execution button for testing and recovery.

Secure the cron endpoint using CRON_SECRET.

Do not expose an unauthenticated cron execution endpoint.

If using Supabase Cron, document exactly how to configure the scheduled request and its secret.

---

# 15. AMC DASHBOARD AND FILTERING

Create a dedicated AMC & Renewals dashboard.

Display:

- Total AMC-enabled websites.
- Active.
- Upcoming.
- Expired.
- Overdue.
- Suspended.
- Exempt.
- Total annual AMC potential.
- AMC revenue collected.
- Pending renewal amount.

Provide filters:

- All.
- Active.
- Upcoming.
- Expired.
- Overdue.
- Suspended.
- Exempt.
- AMC disabled.

Provide date filters.

Provide sorting by:

- Expiry date.
- Client name.
- Renewal amount.
- Days remaining.
- Days overdue.

Show days remaining for upcoming websites.

Show days overdue for expired websites.

Do not label an expired website as upcoming.

Show the upcoming label only when positive remaining days are within the configured threshold.

Add a clear visual distinction between an expired website and one that has actually been suspended.

---

# 16. WHATSAPP MANAGEMENT

Store client mobile numbers and optional separate WhatsApp numbers.

Add WhatsApp buttons to:

- Client profile.
- Website profile.
- AMC records.
- Upcoming renewal list.
- Expired list.
- Suspended website list.

Initially implement manual click-to-chat.

Use the WhatsApp URL format:

https://wa.me/{country_code_and_number}?text={encoded_message}

Do not automatically send messages through an unofficial API.

### Configurable message templates

Allow the administrator to configure messages for:

1. 30-day renewal reminder.
2. 15-day renewal reminder.
3. 7-day renewal reminder.
4. Expiry notification.
5. Grace-period reminder.
6. Website suspension notification.
7. Successful renewal confirmation.
8. Payment reminder.

Support template variables:

- `{client_name}`
- `{contact_person}`
- `{website_name}`
- `{domain}`
- `{mobile}`
- `{amc_amount}`
- `{renewal_amount}`
- `{expiry_date}`
- `{days_remaining}`
- `{days_overdue}`
- `{payment_link}`

Add a live message preview.

Allow editing templates from the settings page.

Add a copy-message button.

### Reminder rules

Use configurable reminder intervals.

Default reminders:

- 30 days.
- 15 days.
- 7 days.

Send only one reminder per configured interval per renewal period.

Store notification history.

If the WhatsApp number is missing, display a warning and do not generate a broken link.

The WhatsApp button should open the correct client chat with the configured message pre-filled.

---

# 17. FULL-PAGE CLIENT WEBSITE SUSPENSION SCREEN

This is another critical requirement.

When a website's license status becomes suspended, the original website must not remain publicly usable.

The user should see a full-page suspension/renewal screen.

Requirements:

- Full viewport coverage.
- Responsive desktop layout.
- Responsive mobile layout.
- No close button.
- No dismiss button.
- No access to the normal public website while suspended.
- No ordinary navigation to bypass the suspension.
- Display configured heading.
- Display configured description.
- Display current renewal price.
- Display renewal button.
- Display optional support contact.
- Display configured branding.
- Display payment status if relevant.

Example default content:

Heading:
"Website Temporarily Unavailable"

Description:
"Your annual website maintenance service has expired. Please complete the renewal payment to restore access."

Button:
"Pay Now"

Support text:
"Please contact your website administrator if you need assistance."

All text must be editable through the CodeWizard admin portal.

### Global suspension screen settings

Allow changing:

- Heading.
- Description.
- Button text.
- Support message.
- Logo.
- Background.
- Text color.
- Button color.
- Branding.
- Support email.
- Support mobile number.

The client website should fetch the current configuration dynamically.

Do not hardcode this content in individual client websites.

### Security and enforcement

Do not implement this as a React-only modal or overlay.

Do not rely solely on browser localStorage.

Use an enforceable Next.js integration:

- A reusable middleware/proxy integration for supported Next.js deployments.
- Server-side license verification.
- Signed license responses.
- Shared CDN or server-side caching.
- Server-side protection of protected routes and APIs.
- Allowlisted renewal/payment routes.

When suspended, the application must render or route to the renewal screen before serving the ordinary protected application experience.

Account for Next.js middleware/proxy version compatibility.

Do not assume that client-side redirects secure server components, API routes or direct data access.

Document how to protect backend APIs and sensitive server-side operations.

Do not cache a suspension response indefinitely.

Do not let stale cached data keep a suspended website active indefinitely.

Use a configurable cache lifetime and a clear fail-safe policy.

If the central license service becomes temporarily unavailable, do not incorrectly interpret the outage as payment expiry.

Previously verified licenses may continue under a bounded offline policy, but an expired or revoked license must not be granted indefinite access.

Payment routes, webhook routes, health checks and required legal/essential pages must remain accessible.

Provide a manual override in the admin portal.

---

# 18. CENTRAL LICENSE API

Create a secure central licensing API.

Each website must have:

- Permanent website UUID.
- Unique public identifier.
- Secure server-side integration credential.
- Domain association.
- License status.
- Validity dates.
- Current renewal quote.
- Suspension configuration.

Do not use a public website ID as an authentication secret.

Provide endpoints with documented request/response contracts.

Suggested endpoints:

POST /api/license/verify

GET /api/license/config

POST /api/license/renewal/create-order

POST /api/license/renewal/verify

POST /api/webhooks/razorpay

GET /api/health

POST /api/cron/amc-check

All endpoint names may be adjusted if there is a better architecture.

### License verification response

Return a signed response containing:

- Website ID.
- License status.
- Validity start.
- Validity end.
- Current renewal amount.
- Suspension screen configuration.
- Response issue time.
- Response expiration time.

Sign responses using a server-side secret.

Validate signatures on the client website's server-side integration.

Do not put signing secrets in frontend JavaScript.

### Performance

One website receiving 10,000 visitors must not generate 10,000 main database queries.

Use:

- Shared CDN/server-side cache.
- Per-website cache keys.
- Signed responses.
- Conditional cache invalidation.
- Reasonable TTL.
- Database indexes.

A cache should reduce requests to Supabase, not become the authoritative source of payment status.

When the admin changes a price, status or configuration, invalidate the corresponding cache.

When a payment succeeds, invalidate the corresponding cache immediately.

Document the limitations of the chosen Netlify caching implementation.

---

# 19. REUSABLE NEXT.JS WEBSITE INTEGRATION

My client websites are developed in Next.js.

Create a reusable integration module within the repository.

Suggested structure:

```text
packages/
  codewizard-license/
    src/
      index.ts
      server.ts
      client.ts
      middleware.ts
      verification.ts
      types.ts
      components/
        LicenseSuspended.tsx
      config.ts
    README.md
```

Also provide an example integration for a separate Next.js client project.

The integration should support:

- Registering the website UUID.
- Configuring server-side credentials.
- License verification.
- Signed response validation.
- Shared caching.
- Suspension screen rendering.
- Renewal payment flow.
- Successful renewal detection.
- Route exclusions.
- Server-side API protection.

Provide an easy integration experience.

For example, a client project should only require:

1. Add the reusable package/module.
2. Configure environment variables.
3. Add the middleware/proxy integration.
4. Protect relevant API routes.
5. Use the shared suspension screen.

Example environment variables for a client website:

```env
CODEWIZARD_API_URL=
CODEWIZARD_WEBSITE_ID=
CODEWIZARD_WEBSITE_SECRET=
```

Never expose WEBSITE_SECRET with a NEXT_PUBLIC_ prefix.

A public website identifier may be exposed if required, but authentication must happen server-side.

Provide a complete README explaining integration into a new Next.js project.

Do not require a complete redeployment to change AMC prices or suspension messages.

---

# 20. RAZORPAY PAYMENT INTEGRATION

Integrate Razorpay properly.

I will provide the Razorpay credentials later.

Implement:

- Create Razorpay orders server-side.
- Open Razorpay Checkout.
- Display renewal amount.
- Attach website ID and renewal quote ID to internal order records.
- Store Razorpay order ID.
- Store Razorpay payment ID.
- Verify checkout signatures server-side.
- Verify payment status through Razorpay APIs/webhooks.
- Handle webhook retries.
- Verify webhook signatures against the raw request body.
- Handle duplicate events idempotently.
- Store payment logs.
- Store failed transactions.
- Store successful transactions.
- Generate receipts.
- Update AMC validity only after verified payment.

Do not activate a license based only on a frontend success callback.

### Renewal payment flow

1. Client opens suspended website.
2. Website requests current renewal configuration.
3. Backend returns current renewal amount.
4. Client clicks Pay Now.
5. Backend creates a Razorpay order using the authoritative amount.
6. Razorpay Checkout opens.
7. Customer completes payment.
8. Backend verifies payment.
9. Backend processes webhook idempotently.
10. Successful payment is recorded.
11. AMC period is created/extended.
12. License status is updated.
13. Cache is invalidated.
14. Website becomes accessible again.

Handle:

- Payment failure.
- Payment cancellation.
- Duplicate webhook.
- Delayed webhook.
- Refund.
- Partial refund.
- Amount mismatch.
- Incorrect website association.
- Expired renewal quote.

### Important renewal rule

If a website has an existing active validity period and renews early, extend from the existing validity end date.

If it has already expired, start the new validity period from the agreed renewal effective date.

Do not accidentally add duplicate renewal periods for the same payment.

### Payment reconciliation

Create an admin transaction page where I can inspect:

- Razorpay order.
- Razorpay payment.
- Internal payment.
- Webhook event.
- Verification status.
- Amount.
- Website.
- Client.
- Timestamp.

Provide a manual reconciliation option for exceptional cases, with an audit trail.

---

# 21. OPTIONAL AUTOMATIC RECURRING BILLING

Prepare the database and architecture for future Razorpay Subscriptions integration.

Do not make automatic recurring billing mandatory in the first version.

Initially support manual annual renewal payments.

Keep fields for:

- Razorpay subscription ID.
- Subscription status.
- Mandate status.
- Next billing date.
- Recurring payment consent.
- Cancellation date.

Do not silently enroll customers in recurring payments.

Only activate automatic billing after explicit customer authorization and successful subscription setup.

---

# 22. SETTINGS MODULE

Create a complete settings section.

### General settings

- Agency name.
- Logo.
- Support email.
- Support mobile.
- Website URL.
- Currency.
- Time zone.
- Invoice prefix.
- Default theme.

### AMC settings

- Default AMC amount.
- Default billing period.
- Upcoming threshold.
- Grace period.
- Default reminder schedule.
- Default renewal settings.
- Default suspension policy.

### Renewal screen settings

- Heading.
- Description.
- Button text.
- Support text.
- Logo.
- Colors.
- Branding.

### WhatsApp settings

- Default country code.
- Message templates.
- Reminder intervals.
- Default client message.

### Payment settings

- Razorpay enabled/disabled.
- Payment methods.
- Invoice configuration.
- Tax configuration.

### System settings

- Cron status.
- Last cron execution.
- License cache configuration.
- Webhook status.
- API health.
- Environment configuration status.

Sensitive secrets must remain in environment variables, not in the database or frontend settings.

---

# 23. ACTIVITY LOGS

Record important events:

- Client created.
- Client updated.
- Website created.
- Domain changed.
- Project created.
- Invoice created.
- Payment received.
- Payment failed.
- AMC configured.
- AMC price changed.
- Negotiated price applied.
- AMC renewed.
- Website expired.
- Website suspended.
- Website manually reactivated.
- License exemption applied.
- Cron execution.
- Webhook received.
- Refund processed.

Each event should include:

- Event ID.
- Event type.
- Relevant client ID.
- Relevant website ID.
- Timestamp.
- Actor.
- Description.
- Previous value where relevant.
- New value where relevant.

Keep financial and security-sensitive logs immutable wherever practical.

---

# 24. SUPABASE DATABASE DESIGN

Design a normalized PostgreSQL database.

At minimum, create these tables:

1. clients
2. client_contacts (if useful)
3. websites
4. website_domains
5. projects
6. project_milestones
7. invoices
8. invoice_items
9. payments
10. refunds
11. amc_contracts
12. amc_periods
13. renewal_quotes
14. license_credentials
15. license_events
16. website_settings
17. notification_templates
18. notification_logs
19. razorpay_orders
20. razorpay_webhook_events
21. cron_execution_logs
22. activity_logs
23. application_settings

Adjust the schema when necessary, but maintain clear relationships and avoid duplicating financial facts.

Use:

- UUID primary keys.
- Foreign keys.
- Proper indexes.
- Unique constraints.
- Appropriate check constraints.
- Created/updated timestamps.
- Soft deletion where appropriate.
- Database transactions for critical operations.

Financial amounts must use integer paise or an equivalent safe integer representation.

Use PostgreSQL constraints to prevent invalid financial and licensing states.

Create SQL migrations under a version-controlled migrations directory.

Include seed data only for development and testing.

Never insert fake business records into production automatically.

### Supabase security

Enable appropriate Row Level Security.

Do not assume that hiding the frontend is sufficient security.

The admin application must authorize every protected operation on the server.

Use the service role only in server-side code.

Client website license APIs must not expose unrestricted database access.

Provide database backup and recovery instructions.

---

# 25. SEARCH, FILTERS AND EXPORTS

Add global search across:

- Client name.
- Business name.
- Mobile number.
- Website name.
- Domain.
- Website ID.
- Invoice number.
- Payment reference.

Add CSV export for:

- Clients.
- Websites.
- Payments.
- Invoices.
- AMC records.
- Renewals.
- Revenue reports.

Exports should respect current filters and permissions.

---

# 26. NOTIFICATION SYSTEM

Build an internal notification system for the admin.

Show notifications when:

- AMC is approaching expiry.
- A website has expired.
- A website is suspended.
- A renewal payment is successful.
- A payment fails.
- A Razorpay webhook fails.
- Cron execution fails.
- A license verification error occurs.

Include unread/read status.

Avoid duplicate notifications.

---

# 27. SECURITY REQUIREMENTS

Treat security as a core requirement.

Implement:

- Secure admin authentication.
- Server-side authorization.
- Input validation.
- Output encoding.
- Rate limiting.
- CSRF protection where applicable.
- Webhook signature validation.
- Signed license responses.
- Secure integration credentials.
- Secret rotation guidance.
- Database access controls.
- Secure cookies.
- Error handling without leaking secrets.
- Audit logging.
- Protection against payment replay.
- Idempotent financial operations.
- Protection against unauthorized website ID manipulation.
- Protection against direct API access.
- Protection against renewal amount manipulation.

Do not store payment card information.

Use Razorpay Checkout for payment collection.

Never log complete secrets, passwords or sensitive credentials.

---

# 28. ERROR HANDLING AND RELIABILITY

Implement consistent API responses.

Handle:

- Supabase unavailable.
- Database errors.
- Razorpay unavailable.
- Invalid payment signature.
- Duplicate webhook.
- Invalid license credentials.
- Expired license.
- Cache unavailable.
- Cron failure.
- Invalid environment configuration.

A temporary license API outage must not automatically be treated as AMC expiry.

A database failure must not produce a false successful payment.

Use bounded retry logic where appropriate.

Provide structured server logs.

Create an admin system health page.

---

# 29. TESTING

Do not consider the project complete without tests.

Implement unit tests and integration tests for:

### AMC calculation

- Active website.
- Upcoming website.
- Expiry date.
- Grace period.
- Overdue.
- Suspended.
- Exempt.
- AMC disabled.
- Leap year.
- Month boundary.
- IST date handling.
- Early renewal.
- Late renewal.
- Manual extension.

### Payment tests

- Successful payment.
- Failed payment.
- Invalid signature.
- Duplicate webhook.
- Delayed webhook.
- Incorrect amount.
- Duplicate order.
- Refund.
- Payment associated with wrong website.

### Authentication tests

- Correct admin credentials.
- Incorrect password.
- Unauthorized dashboard access.
- Session expiration.
- Logout.
- Login rate limiting.

### License tests

- Active website.
- Expired website.
- Suspended website.
- Manual override.
- Signed response validation.
- Invalid signature.
- Cache expiration.
- Cache invalidation.
- License API outage.

### UI tests

- Responsive dashboard.
- Client creation.
- Website creation.
- AMC price modification.
- WhatsApp message generation.
- Renewal screen.
- Payment success state.

Include test instructions and sample test scenarios.

---

# 30. DEPLOYMENT AND DOCUMENTATION

Provide:

1. Complete `.env.example`.
2. Supabase setup instructions.
3. Database migration instructions.
4. Razorpay setup instructions.
5. Webhook configuration instructions.
6. Cron configuration instructions.
7. Netlify deployment instructions.
8. Admin login instructions.
9. New client creation instructions.
10. Website registration instructions.
11. Client Next.js integration instructions.
12. License verification documentation.
13. Renewal and payment documentation.
14. Troubleshooting guide.
15. Backup and recovery guide.

Create:

- README.md
- ARCHITECTURE.md
- DATABASE.md
- API.md
- DEPLOYMENT.md
- CLIENT-WEBSITE-INTEGRATION.md
- PAYMENT-FLOW.md
- SECURITY.md

Explain exactly which credentials I must obtain and where to paste them.

---

# 31. IMPLEMENTATION ORDER

Work in these phases.

### Phase 1: Foundation

- Inspect the project directory.
- Initialize Next.js if required.
- Set up TypeScript.
- Set up Tailwind.
- Set up shadcn/ui.
- Set up Supabase client/server integration.
- Create environment validation.
- Create the application layout.
- Implement admin authentication.

### Phase 2: Database and backend

- Design database.
- Create migrations.
- Implement clients API.
- Implement websites API.
- Implement projects API.
- Implement financial APIs.
- Implement AMC APIs.
- Implement activity logs.

### Phase 3: Admin frontend

- Dashboard.
- Client management.
- Website management.
- Project management.
- Payments.
- Invoices.
- AMC dashboard.
- Settings.
- Activity logs.

### Phase 4: Licensing system

- License API.
- Secure website credentials.
- Signed responses.
- Shared caching.
- Suspension screen.
- Next.js integration package.
- Server-side access enforcement.

### Phase 5: Automation

- Daily AMC cron.
- Expiry processing.
- Upcoming reminders.
- Grace-period handling.
- Automatic suspension.
- Cache invalidation.
- Admin notifications.

### Phase 6: Razorpay

- Order creation.
- Checkout integration.
- Webhook handling.
- Payment verification.
- Renewal processing.
- Reactivation.
- Transaction reconciliation.

### Phase 7: Testing and deployment

- Run all tests.
- Fix TypeScript errors.
- Fix lint errors.
- Check security.
- Verify responsive design.
- Verify payment flows using Razorpay test mode.
- Verify cron execution.
- Verify a suspended website end-to-end.
- Write deployment documentation.

---

# 32. IMPORTANT EXECUTION INSTRUCTIONS

Follow these instructions strictly.

1. First inspect the existing project directory and existing dependencies.
2. Preserve useful existing code if any exists.
3. If the project is empty, initialize the complete project.
4. Do not unnecessarily ask me for information that can be handled with reasonable defaults.
5. When credentials are needed, create placeholders and continue implementing the rest of the application.
6. Do not use mock data as a replacement for real functionality.
7. Do not build non-functional buttons.
8. Do not leave critical features as TODO comments.
9. Do not skip backend implementation.
10. Do not expose sensitive environment variables.
11. Do not create separate applications for the admin portal and licensing engine.
12. Do not create a separate backend framework.
13. Keep everything in one Next.js repository.
14. Keep client website integration reusable and documented.
15. Make the application production-oriented and maintainable.
16. Use clean, reusable components and modular server-side services.
17. Use proper database transactions for financial and licensing operations.
18. Never activate a license based only on a browser-side payment response.
19. Never suspend a website just because a license API temporarily failed.
20. Clearly document any feature that cannot be fully activated without external credentials or deployment configuration.

If a technical limitation prevents an exact requirement, implement the closest secure and reliable alternative and document the limitation.

## Final acceptance criteria

The application is complete only when I can:

- Log in to my private CodeWizard admin portal.
- Create a client and store their mobile and WhatsApp numbers.
- Create multiple websites under that client.
- Add or later update the website domain.
- Record development charges.
- Record advances and other payments.
- See outstanding development balances.
- Configure AMC independently for each website.
- Set different AMC prices for different clients.
- Change a renewal amount after expiry without redeploying the website.
- See upcoming renewals within the configured threshold.
- Automatically detect expired websites even if they receive zero visitors.
- Automatically suspend a website after the configured grace period.
- See the full-page renewal screen on the client's Next.js website.
- Allow the client to pay using Razorpay.
- Verify the payment through the backend.
- Automatically restore the website after verified payment.
- Send a pre-filled WhatsApp message to the client.
- Change renewal-screen wording from the admin portal.
- See revenue, AMC collection and pending payments.
- Export records and generate invoices.
- View logs of important activities.
- Monitor cron and webhook health.

**Start by inspecting the repository and then implement the application systematically. Do not stop after creating the design or database schema. Build the working product end-to-end.**