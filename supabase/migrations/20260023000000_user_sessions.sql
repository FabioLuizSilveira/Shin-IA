-- User sessions
-- Tracks all active and inactive sessions for audit and concurrent session limits

create table if not exists user_sessions (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid          not null,
  user_id          uuid          not null,
  auth_session_id  text          not null,
  ip_address       text,
  user_agent       text,

  -- Session state
  status           text          not null default 'active' check (status in ('active', 'expired', 'revoked')),

  -- MFA verification state
  mfa_verified     boolean       not null default false,
  mfa_verified_at  timestamptz,
  mfa_method       text,

  -- Impersonation tracking
  is_impersonated  boolean       not null default false,
  impersonation_id uuid,

  -- Delegation tracking
  delegation_id    uuid,

  -- Timestamps
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  expires_at       timestamptz   not null,
  last_activity_at timestamptz   not null default now(),

  metadata         jsonb         not null default '{}',

  constraint user_sessions_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,

  constraint user_sessions_user_fk
    foreign key (user_id) references user_profiles (id) on delete cascade,

  constraint user_sessions_auth_session_id_unique
    unique (auth_session_id)
);

-- RLS: Users can read their own sessions; tenant admins can read all
alter table user_sessions enable row level security;
alter table user_sessions force row level security;

create policy "user_sessions_select_own"
  on user_sessions for select
  to authenticated
  using (user_id = (select id from user_profiles where auth_user_id = auth.uid() and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid));

create policy "user_sessions_select_tenant"
  on user_sessions for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Indexes
create index user_sessions_tenant_id_idx on user_sessions (tenant_id);
create index user_sessions_user_id_idx on user_sessions (user_id);
create index user_sessions_status_idx on user_sessions (status);
create index user_sessions_expires_at_idx on user_sessions (expires_at);
create index user_sessions_auth_session_id_idx on user_sessions (auth_session_id);
