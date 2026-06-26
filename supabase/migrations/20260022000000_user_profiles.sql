-- User profiles linked to Supabase Auth users
-- Stores additional metadata beyond what auth.users provides

create table if not exists user_profiles (
  id               uuid          primary key,
  tenant_id        uuid          not null,
  auth_user_id     uuid          not null,
  email            text          not null,
  full_name        text          not null,
  phone_number     text,
  avatar_url       text,
  mfa_required     boolean       not null default false,
  mfa_method       text          check (mfa_method in ('totp', 'sms', 'email', 'webauthn') or mfa_method is null),
  last_login_at    timestamptz,
  failed_login_attempts integer   not null default 0,
  locked_until     timestamptz,
  status           text          not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  metadata         jsonb         not null default '{}',
  version          integer       not null default 1,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,

  constraint user_profiles_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,

  constraint user_profiles_auth_user_id_unique
    unique (auth_user_id),

  constraint user_profiles_email_unique
    unique (email)
);

-- RLS: Users can read their own profile; admins can read all
alter table user_profiles enable row level security;
alter table user_profiles force row level security;

create policy "user_profiles_select_own"
  on user_profiles for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "user_profiles_select_tenant"
  on user_profiles for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "user_profiles_update_own"
  on user_profiles for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Indexes
create index user_profiles_tenant_id_idx on user_profiles (tenant_id);
create index user_profiles_auth_user_id_idx on user_profiles (auth_user_id);
create index user_profiles_status_idx on user_profiles (status);
create index user_profiles_locked_until_idx on user_profiles (locked_until);
