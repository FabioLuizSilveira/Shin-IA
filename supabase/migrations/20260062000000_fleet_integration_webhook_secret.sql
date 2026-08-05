-- Security fix (MÉD-16): fleet_integrations.webhook_token was a bare
-- bearer credential in the URL path — no signature covered the request
-- body, so anyone who obtained the token (proxy/CDN logs, browser history,
-- Referer leakage — it's a path segment, not a header) could inject
-- arbitrary GPS coordinates for that tenant indefinitely.
--
-- Adds a per-integration signing secret so the webhook route can verify an
-- HMAC-SHA256 signature over the raw request body when the sender includes
-- one (X-Signature header) — see api/webhooks/fleet-location/[token]/route.ts.
-- Existing rows get a secret backfilled by the column default so nothing
-- breaks; verification stays optional per-request (only enforced when the
-- header is present) since this is a bring-your-own-webhook integration —
-- making it mandatory would require every already-configured external GPS
-- provider to be updated first, which this migration can't do for them.

-- gen_random_bytes() needs the pgcrypto extension, which isn't enabled on
-- this project — two concatenated gen_random_uuid()s (built-in, no
-- extension needed) give an equivalent amount of cryptographically random
-- entropy for a signing secret.
alter table fleet_integrations
  add column if not exists webhook_secret text not null default replace(
    gen_random_uuid()::text || gen_random_uuid()::text,
    '-',
    ''
  );
