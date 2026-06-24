-- M003: tenants — platform root table
-- No tenant_id column (this IS the tenant). No DEFAULT on id (domain-generated).
-- Decision #1: id has no DEFAULT gen_random_uuid()
-- Decision #9: default_currency configures currency for all tenant Money columns

create table tenants (
  id               uuid          primary key,
  name             text          not null,
  slug             text          not null,
  plan             tenant_plan   not null default 'starter',
  status           tenant_status not null default 'trialing',
  default_currency text          not null default 'BRL',
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,

  constraint tenants_slug_format check (slug ~* '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

create unique index tenants_slug_key on tenants (slug);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table tenants enable row level security;
alter table tenants force row level security;

-- Authenticated users see only their own tenant
create policy "tenants_select_own"
  on tenants for select
  to authenticated
  using (id = (auth.jwt() ->> 'tenant_id')::uuid);

-- INSERT and UPDATE are service-role only (no policy = denied for authenticated)
-- DELETE is blocked for all roles
