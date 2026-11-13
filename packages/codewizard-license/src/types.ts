/**
 * CodeWizard License Engine - shared types.
 */

export type LicenseStatus =
  | "active"
  | "upcoming"
  | "expired"
  | "overdue"
  | "suspended"
  | "exempt"
  | "disabled";

export type AccessStatus = "active" | "suspended" | "manual_suspended" | "archived";

export interface SuspensionConfig {
  heading: string;
  description: string;
  buttonText: string;
  supportText: string;
  logoUrl: string;
  background: string;
  textColor: string;
  buttonColor: string;
  showSupport: boolean;
  supportEmail: string;
  supportPhone: string;
}

export interface LicensePayload {
  website_id: string;
  public_id: string;
  client_id: string;
  website_name: string;
  status: LicenseStatus;
  access_status: AccessStatus;
  license_valid: boolean;
  validity_start: string | null;
  validity_end: string | null;
  renewal_amount_paise: number;
  currency: string;
  renewal_quote_id: string | null;
  suspension: SuspensionConfig | null;
  issued_at: number;
  expires_at: number;
}

export interface LicenseVerification {
  token: string;
  payload: LicensePayload;
  cached: boolean;
}

export interface RenewalOrder {
  order_id: string;
  internal_order_ref: string;
  amount_paise: number;
  currency: string;
  razorpay_key_id: string;
  receipt: string;
  quote_id: string | null;
  website_name: string;
}

export interface PaymentVerification {
  verified: boolean;
  license_valid: boolean;
  validity_end: string | null;
  payment_id: string;
  order_id: string;
}

export interface LicenseConfig {
  apiUrl: string;
  websiteId: string;
  websiteSecret: string;
  cacheTtlSeconds: number;
  offlineGraceSeconds: number;
  failClosed: boolean;
}

export interface VerifyOptions {
  /** Force a fresh network request, bypassing the local cache. */
  fresh?: boolean;
}

export interface LicenseResult {
  ok: boolean;
  verification?: LicenseVerification;
  error?: string;
  /** True when the result came from the bounded offline cache. */
  fromOfflineCache?: boolean;
}
