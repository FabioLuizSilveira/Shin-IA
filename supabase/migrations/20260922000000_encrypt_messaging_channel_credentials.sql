-- Encrypts messaging_channel_credentials.access_token at rest, closing the
-- gap flagged since 20260919000000 (plain text token in a DB row). pgcrypto
-- was confirmed enabled on this project (v1.3, via
-- `select extname,extversion from pg_extension where extname='pgcrypto'`),
-- but it is installed in the `extensions` schema, not `public`/the default
-- search_path — that's why 20260062000000's `gen_random_bytes()` call failed
-- unqualified. `extensions.pgp_sym_encrypt`/`pgp_sym_decrypt` work fine when
-- schema-qualified (live-verified).
--
-- No real messaging_channel_credentials rows exist yet (0 rows — no Meta App
-- registered, no real WABA ever connected), so this is a clean column swap,
-- not a backfill: no plaintext token has ever been at rest in this table.
--
-- Key management: the encryption key is NEVER stored in the database. It is
-- passed as a parameter at call time by the app (MESSAGING_TOKEN_ENCRYPTION_KEY
-- env var, set in Vercel — outside this migration's control) via the two RPC
-- wrappers below. EXECUTE is revoked from anon/authenticated so only the
-- service-role backend (which already has unrestricted table access — this
-- is defense against a future accidental grant, not the primary boundary)
-- can call them.
alter table messaging_channel_credentials
  add column if not exists access_token_enc bytea;

alter table messaging_channel_credentials
  drop column if exists access_token;

create or replace function encrypt_messaging_token(token text, key text)
returns bytea
language sql
security definer
set search_path = extensions, pg_temp
as $$
  select extensions.pgp_sym_encrypt(token, key);
$$;

create or replace function decrypt_messaging_token(ciphertext bytea, key text)
returns text
language sql
security definer
set search_path = extensions, pg_temp
as $$
  select extensions.pgp_sym_decrypt(ciphertext, key);
$$;

revoke all on function encrypt_messaging_token(text, text) from public, anon, authenticated;
revoke all on function decrypt_messaging_token(bytea, text) from public, anon, authenticated;
grant execute on function encrypt_messaging_token(text, text) to service_role;
grant execute on function decrypt_messaging_token(bytea, text) to service_role;
