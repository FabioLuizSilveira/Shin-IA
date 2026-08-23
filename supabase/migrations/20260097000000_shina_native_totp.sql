-- Shinã-native TOTP (RFC 6238), independent of Supabase Auth's or
-- Firebase's own MFA — decided against both: login/signup never requires
-- MFA going forward, this is a step-up mechanism for specific sensitive
-- actions (not yet wired to any action this migration — foundation only,
-- per this round's explicit scope decision), keyed by the canonical
-- shina_user_id (packages/identity), not any provider-specific user id.
--
-- Distinct from the older mfa_enrollments table (20260024000000), which
-- recorded Supabase Auth's own built-in TOTP factor id — that table stays
-- as historical record for existing Supabase-enrolled users; this one is
-- the new source of truth going forward.
create table if not exists shina_totp_credentials (
  id uuid primary key default gen_random_uuid(),
  shina_user_id uuid not null unique,
  encrypted_secret text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  last_used_at timestamptz
);

create index if not exists shina_totp_credentials_shina_user_id_idx
  on shina_totp_credentials (shina_user_id);

alter table shina_totp_credentials enable row level security;
-- No policies — service-role only. All interaction goes through
-- apps/web/src/app/api/auth/mfa/native/* routes, which authenticate the
-- caller themselves before touching this table; there is no legitimate
-- reason for a client to query it directly.
