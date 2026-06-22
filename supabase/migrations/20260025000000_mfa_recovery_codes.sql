-- MFA recovery codes
-- One-time use backup codes for account recovery if MFA device is lost

create table if not exists mfa_recovery_codes (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid          not null,
  user_id          uuid          not null,
  mfa_enrollment_id uuid         not null,

  -- Recovery code (hashed in production)
  code             text          not null,

  -- Status
  used             boolean       not null default false,
  used_at          timestamptz,
  used_session_id  uuid,

  -- Timestamps
  created_at       timestamptz   not null default now(),

  constraint mfa_recovery_codes_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,

  constraint mfa_recovery_codes_user_fk
    foreign key (user_id) references user_profiles (id) on delete cascade,

  constraint mfa_recovery_codes_enrollment_fk
    foreign key (mfa_enrollment_id) references mfa_enrollments (id) on delete cascade,

  constraint mfa_recovery_codes_code_unique
    unique (code)
);

-- RLS: Users can read their own recovery codes (full list only shown once during setup)
alter table mfa_recovery_codes enable row level security;
alter table mfa_recovery_codes force row level security;

create policy "mfa_recovery_codes_select_own"
  on mfa_recovery_codes for select
  to authenticated
  using (user_id = (select id from user_profiles where auth_user_id = auth.uid() and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid));

-- Indexes
create index mfa_recovery_codes_tenant_id_idx on mfa_recovery_codes (tenant_id);
create index mfa_recovery_codes_user_id_idx on mfa_recovery_codes (user_id);
create index mfa_recovery_codes_mfa_enrollment_id_idx on mfa_recovery_codes (mfa_enrollment_id);
create index mfa_recovery_codes_used_idx on mfa_recovery_codes (used);
