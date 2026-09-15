import type { SupabaseClient } from "@supabase/supabase-js";

// Encryption key lives only in the process environment
// (MESSAGING_TOKEN_ENCRYPTION_KEY), never in the database — the two
// Postgres functions below (created in 20260922000000_encrypt_messaging_
// channel_credentials.sql) accept it as a call-time parameter. Fails loud
// rather than silently storing tokens in plain text if the key is missing.
function getEncryptionKey(): string {
  const key = process.env.MESSAGING_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "MESSAGING_TOKEN_ENCRYPTION_KEY is not set — refusing to store/read a messaging channel access token unencrypted",
    );
  }
  return key;
}

export async function encryptToken(db: SupabaseClient, token: string): Promise<string> {
  const { data, error } = await db.rpc("encrypt_messaging_token", {
    token,
    key: getEncryptionKey(),
  });
  if (error || data == null) throw error ?? new Error("failed to encrypt messaging token");
  return data as string;
}

export async function decryptToken(db: SupabaseClient, ciphertext: string): Promise<string> {
  const { data, error } = await db.rpc("decrypt_messaging_token", {
    ciphertext,
    key: getEncryptionKey(),
  });
  if (error || data == null) throw error ?? new Error("failed to decrypt messaging token");
  return data as string;
}
