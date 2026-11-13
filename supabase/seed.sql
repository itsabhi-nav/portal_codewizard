-- ============================================================================
-- CodeWizard - Safe default seed data.
-- Applied manually for development/testing. Contains NO fake business records.
-- Run: supabase db reset  (or psql -f supabase/seed.sql)
-- ============================================================================

-- Default application settings
insert into public.application_settings (key, value, description)
values (
  'app_settings',
  '{
    "general": {
      "agencyName": "CodeWizard",
      "logoUrl": "",
      "supportEmail": "",
      "supportPhone": "",
      "websiteUrl": "",
      "currency": "INR",
      "timezone": "Asia/Kolkata",
      "invoicePrefix": "INV",
      "defaultTheme": "system"
    },
    "amc": {
      "defaultAmountPaise": 0,
      "defaultBillingPeriodDays": 365,
      "upcomingThresholdDays": 10,
      "gracePeriodDays": 3,
      "reminderIntervals": [30, 15, 7],
      "autoSuspend": true,
      "autoRemind": true
    },
    "renewalScreen": {
      "heading": "Website Temporarily Unavailable",
      "description": "Your annual website maintenance service has expired. Please complete the renewal payment to restore access.",
      "buttonText": "Pay Now",
      "supportText": "Please contact your website administrator if you need assistance.",
      "logoUrl": "",
      "background": "#0b1220",
      "textColor": "#ffffff",
      "buttonColor": "#2563eb",
      "showSupport": true,
      "supportEmail": "",
      "supportPhone": ""
    },
    "whatsapp": {
      "defaultCountryCode": "91",
      "defaultMessage": "",
      "reminderIntervals": [30, 15, 7]
    },
    "payments": {
      "razorpayEnabled": false,
      "methods": ["razorpay", "upi", "bank_transfer", "cash", "other"],
      "taxEnabled": false,
      "taxRatePercent": 0,
      "taxLabel": "",
      "invoiceNotes": ""
    }
  }'::jsonb,
  'Global application settings'
)
on conflict (key) do nothing;

-- Default WhatsApp message templates
insert into public.notification_templates (key, name, subject, body, is_active) values
('reminder_30', '30-day renewal reminder', null,
 'Hello {client_name}, this is a friendly reminder that your website {website_name} annual maintenance renewal of {renewal_amount} is due on {expiry_date}. Please renew to keep your website active.', true),
('reminder_15', '15-day renewal reminder', null,
 'Hello {client_name}, your website {website_name} maintenance renewal of {renewal_amount} is due in {days_remaining} days ({expiry_date}). Kindly complete the payment to avoid interruption.', true),
('reminder_7', '7-day renewal reminder', null,
 'Hello {client_name}, only {days_remaining} days left for your website {website_name} renewal of {renewal_amount}. Please pay by {expiry_date} to keep your website running.', true),
('expiry', 'Expiry notification', null,
 'Hello {client_name}, your website {website_name} annual maintenance expired on {expiry_date}. Please renew {renewal_amount} to restore full access.', true),
('grace_period', 'Grace-period reminder', null,
 'Hello {client_name}, your website {website_name} is in the grace period. Renewal of {renewal_amount} is pending. Please pay now to avoid suspension.', true),
('suspension', 'Website suspension notification', null,
 'Hello {client_name}, your website {website_name} has been suspended due to an expired maintenance plan. Please renew {renewal_amount} to restore access immediately.', true),
('renewal_success', 'Successful renewal confirmation', null,
 'Hello {client_name}, thank you! Your website {website_name} maintenance has been renewed for {renewal_amount}. New validity: {expiry_date}.', true),
('payment_reminder', 'Payment reminder', null,
 'Hello {client_name}, this is a reminder that {renewal_amount} is pending for {website_name}. Please complete the payment at your earliest convenience.', true)
on conflict (key) do nothing;
