import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateLicenseSecret } from "@/lib/ids";

/**
 * Provision a secure server-side integration credential for a website.
 * The secret is returned ONCE to the administrator and only its bcrypt hash
 * is stored in the database.
 */
export async function provisionLicenseCredential(
  client: SupabaseClient,
  websiteId: string,
  publicId: string
): Promise<{ secret: string; credentialId: string; prefix: string }> {
  const secret = generateLicenseSecret();
  const secretHash = await bcrypt.hash(secret, 10);
  const prefix = secret.slice(-4);

  const { data, error } = await client
    .from("license_credentials")
    .insert({
      website_id: websiteId,
      website_uuid: websiteId,
      public_id: publicId,
      secret_hash: secretHash,
      secret_prefix: prefix,
      is_active: true,
      last_rotated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to provision license credential: ${error.message}`);
  return { secret, credentialId: data.id, prefix };
}

/** Rotate an existing credential. The old hash is replaced; the new secret is returned once. */
export async function rotateLicenseCredential(
  client: SupabaseClient,
  credentialId: string
): Promise<{ secret: string; prefix: string }> {
  const secret = generateLicenseSecret();
  const secretHash = await bcrypt.hash(secret, 10);
  const prefix = secret.slice(-4);

  const { error } = await client
    .from("license_credentials")
    .update({
      secret_hash: secretHash,
      secret_prefix: prefix,
      last_rotated_at: new Date().toISOString(),
    })
    .eq("id", credentialId);

  if (error) throw new Error(`Failed to rotate license credential: ${error.message}`);
  return { secret, prefix };
}
