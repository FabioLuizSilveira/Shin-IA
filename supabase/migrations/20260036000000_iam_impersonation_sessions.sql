-- Impersonation Sessions
-- Audit log of impersonation sessions initiated by platform operators

create table if not exists impersonation_sessions (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid          not null,
  platform_actor_id uuid         not null, -- platform user performing impersonation
  target_user_id   uuid          not null, -- tenant user being impersonated
  target_tenant_id uuid          not null, -- tenant of target user
  reason           text          not null,
  access_mode      text          not null check (access_mode in ('full', 'read_only')),
  secondary_auth_by uuid,        -- who approved this session (if required)
  status           text          not null default 'active' check (status in ('active', 'revoked', 'expired')),
  started_at       timestamptz   not null default now(),
  ended_at         timestamptz,
  max_duration_minutes integer   default 240, -- 4 hours for full, 2 hours for read_only
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,

  constraint impersonation_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,

  constraint impersonation_target_user_fk
    foreign key (target_user_id) references user_profiles (id) on delete cascade
);

-- RLS: Only platform admins and target tenant admins can view
alter table impersonation_sessions enable row level security;
alter table impersonation_sessions force row level security;

create policy "impersonation_select_tenant_admin"
  on impersonation_sessions for select
  to authenticated
  using (
    target_tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create index impersonation_tenant_id_idx on impersonation_sessions (tenant_id);
create index impersonation_target_user_id_idx on impersonation_sessions (target_user_id);
create index impersonation_target_tenant_id_idx on impersonation_sessions (target_tenant_id);
create index impersonation_status_idx on impersonation_sessions (status);
create index impersonation_started_at_idx on impersonation_sessions (started_at);
