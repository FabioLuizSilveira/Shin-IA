-- M-MKT-01: marketing ai foundation — workspaces, brand kits, safety layer,
-- ai providers and usage tracking. all tables are tenant-scoped with rls.

-- ── workspaces ────────────────────────────────────────────────────────────────

create table mkt_workspaces (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      uuid        not null,
  name           text        not null,
  slug           text        not null unique,
  plan           text        not null default 'free',
  mode           text        not null default 'standalone',
  credits_used   bigint      not null default 0,
  credits_limit  bigint      not null default 500,
  settings       jsonb       not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint mkt_workspaces_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_workspaces_plan_check
    check (plan in ('free', 'starter', 'pro', 'business', 'enterprise')),
  constraint mkt_workspaces_mode_check
    check (mode in ('standalone', 'plugin'))
);

create index mkt_workspaces_tenant_id_idx on mkt_workspaces (tenant_id);

-- ── brand kits ────────────────────────────────────────────────────────────────

create table mkt_brand_kits (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null,
  tenant_id      uuid        not null,
  name           text        not null,
  logo_url       text,
  logo_dark_url  text,
  palette        jsonb       not null default '[]',
  fonts          jsonb       not null default '{}',
  tone_of_voice  text,
  tagline        text,
  description    text,
  website_url    text,
  product_images text[]      not null default '{}',
  is_default     boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint mkt_brand_kits_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_brand_kits_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index mkt_brand_kits_workspace_idx on mkt_brand_kits (workspace_id);
create index mkt_brand_kits_tenant_idx on mkt_brand_kits (tenant_id);

-- ── safety layer: drafts require human approval before hitting ad platforms ──

create table mkt_drafts (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null,
  tenant_id     uuid        not null,
  entity_type   text        not null,
  entity_id     uuid,
  action        text        not null,
  payload       jsonb       not null,
  diff          jsonb,
  status        text        not null default 'pending',
  requested_by  uuid        not null,
  agent_id      text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  review_note   text,
  applied_at    timestamptz,
  created_at    timestamptz not null default now(),

  constraint mkt_drafts_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_drafts_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_drafts_status_check
    check (status in ('pending', 'approved', 'rejected', 'applied', 'rolled_back')),
  constraint mkt_drafts_action_check
    check (action in ('create', 'update', 'delete', 'publish', 'pause', 'budget_change'))
);

create index mkt_drafts_workspace_status_idx on mkt_drafts (workspace_id, status);
create index mkt_drafts_tenant_idx on mkt_drafts (tenant_id);

-- ── audit trail ───────────────────────────────────────────────────────────────

create table mkt_audit_trail (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null,
  tenant_id    uuid        not null,
  user_id      uuid,
  agent_id     text,
  action       text        not null,
  entity_type  text        not null,
  entity_id    uuid,
  payload      jsonb,
  ip           text,
  user_agent   text,
  created_at   timestamptz not null default now(),

  constraint mkt_audit_trail_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_audit_trail_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index mkt_audit_trail_workspace_idx on mkt_audit_trail (workspace_id, created_at desc);
create index mkt_audit_trail_tenant_idx on mkt_audit_trail (tenant_id);

-- ── ai providers (bring your own key, encrypted at rest) ─────────────────────

create table mkt_ai_providers (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null,
  tenant_id         uuid        not null,
  provider          text        not null,
  api_key_enc       text,
  base_url          text,
  default_model     text,
  is_active         boolean     not null default true,
  is_default        boolean     not null default false,
  monthly_limit_usd numeric(10, 2),
  created_at        timestamptz not null default now(),

  constraint mkt_ai_providers_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_ai_providers_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_ai_providers_provider_check
    check (provider in ('anthropic', 'openai', 'gemini', 'deepseek', 'mistral', 'groq', 'openrouter', 'ollama')),
  constraint mkt_ai_providers_unique unique (workspace_id, provider)
);

create index mkt_ai_providers_workspace_idx on mkt_ai_providers (workspace_id);

-- ── ai usage tracking ─────────────────────────────────────────────────────────

create table mkt_ai_usage (
  id           uuid           primary key default gen_random_uuid(),
  workspace_id uuid           not null,
  tenant_id    uuid           not null,
  user_id      uuid,
  agent_id     text,
  provider     text           not null,
  model        text           not null,
  operation    text           not null,
  tokens_in    integer        not null default 0,
  tokens_out   integer        not null default 0,
  cost_usd     numeric(10, 6),
  duration_ms  integer,
  entity_type  text,
  entity_id    uuid,
  created_at   timestamptz    not null default now(),

  constraint mkt_ai_usage_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_ai_usage_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index mkt_ai_usage_workspace_idx on mkt_ai_usage (workspace_id, created_at desc);
create index mkt_ai_usage_tenant_idx on mkt_ai_usage (tenant_id);

-- ── rls ───────────────────────────────────────────────────────────────────────

alter table mkt_workspaces   enable row level security;
alter table mkt_workspaces   force row level security;
alter table mkt_brand_kits   enable row level security;
alter table mkt_brand_kits   force row level security;
alter table mkt_drafts       enable row level security;
alter table mkt_drafts       force row level security;
alter table mkt_audit_trail  enable row level security;
alter table mkt_audit_trail  force row level security;
alter table mkt_ai_providers enable row level security;
alter table mkt_ai_providers force row level security;
alter table mkt_ai_usage     enable row level security;
alter table mkt_ai_usage     force row level security;

create policy "mkt_workspaces_select" on mkt_workspaces for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_workspaces_insert" on mkt_workspaces for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_workspaces_update" on mkt_workspaces for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "mkt_brand_kits_select" on mkt_brand_kits for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_brand_kits_insert" on mkt_brand_kits for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_brand_kits_update" on mkt_brand_kits for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_brand_kits_delete" on mkt_brand_kits for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "mkt_drafts_select" on mkt_drafts for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_drafts_insert" on mkt_drafts for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_drafts_update" on mkt_drafts for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- audit trail is append-only: no update/delete policies
create policy "mkt_audit_trail_select" on mkt_audit_trail for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_audit_trail_insert" on mkt_audit_trail for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "mkt_ai_providers_select" on mkt_ai_providers for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ai_providers_insert" on mkt_ai_providers for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ai_providers_update" on mkt_ai_providers for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ai_providers_delete" on mkt_ai_providers for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "mkt_ai_usage_select" on mkt_ai_usage for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ai_usage_insert" on mkt_ai_usage for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
