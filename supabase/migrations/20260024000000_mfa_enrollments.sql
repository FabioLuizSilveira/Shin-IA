-- MFA enrollments
-- Tracks MFA methods enrolled by users

create table if not exists mfa_enrollments (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid          not null,
  user_id          uuid          not null,

  -- MFA type
  method           text          not null check (method in ('totp', 'sms', 'email', 'webauthn')),

  -- TOTP: secret key (encrypted in production)
  -- SMS: phone number
  -- WebAuthn: credential ID
  credential       text          not null,

  -- Status
  status           text          not null default 'active' check (status in ('active', 'inactive', 'pending')),

  -- MFA as primary (only one per method per user)
  is_primary       boolean       not null default false,

  -- Recovery backup enabled
  backup_enabled   boolean       not null default false,

  -- Verification state
  verified_at      timestamptz,
  last_used_at     timestamptz,

  -- Timestamps
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,

  metadata         jsonb         not null default '{}',

  constraint mfa_enrollments_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,

  constraint mfa_enrollments_user_fk
    foreign key (user_id) references user_profiles (id) on delete cascade
);

create unique index mfa_enrollments_primary_unique 
  on mfa_enrollments (user_id, method) 
  where is_primary = true;

-- RLS: Users can read/manage their own enrollments
alter table mfa_enrollments enable row level security;
alter table mfa_enrollments force row level security;

create policy "mfa_enrollments_select_own"
  on mfa_enrollments for select
  to authenticated
  using (user_id = (select id from user_profiles where auth_user_id = auth.uid() and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid));

create policy "mfa_enrollments_insert_own"
  on mfa_enrollments for insert
  to authenticated
  with check (user_id = (select id from user_profiles where auth_user_id = auth.uid() and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid));

create policy "mfa_enrollments_update_own"
  on mfa_enrollments for update
  to authenticated
  using (user_id = (select id from user_profiles where auth_user_id = auth.uid() and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid))
  with check (user_id = (select id from user_profiles where auth_user_id = auth.uid() and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid));

create policy "mfa_enrollments_delete_own"
  on mfa_enrollments for delete
  to authenticated
  using (user_id = (select id from user_profiles where auth_user_id = auth.uid() and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid));

-- Indexes
create index mfa_enrollments_tenant_id_idx on mfa_enrollments (tenant_id);
create index mfa_enrollments_user_id_idx on mfa_enrollments (user_id);
create index mfa_enrollments_method_idx on mfa_enrollments (method);
create index mfa_enrollments_status_idx on mfa_enrollments (status);
