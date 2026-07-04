-- M-MKT-05: campaigns, ads and platform integrations.
-- campaigns are draft-first: creation and mutations flow through mkt_drafts
-- and require human approval before touching any ad platform.

create table mkt_campaigns (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null,
  tenant_id       uuid        not null,
  brand_kit_id    uuid        references mkt_brand_kits (id) on delete set null,
  name            text        not null,
  platform        text        not null,
  objective       text,
  budget_daily    numeric(12, 2),
  budget_total    numeric(12, 2),
  budget_currency text        not null default 'BRL',
  start_date      date,
  end_date        date,
  targeting       jsonb       not null default '{}',
  status          text        not null default 'draft',
  platform_id     text,
  published_at    timestamptz,
  approved_by     uuid,
  approved_at     timestamptz,
  created_by      uuid        not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint mkt_campaigns_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_campaigns_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_campaigns_platform_check
    check (platform in ('meta', 'google', 'tiktok', 'linkedin')),
  constraint mkt_campaigns_status_check
    check (status in ('draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'archived'))
);

create index mkt_campaigns_workspace_idx on mkt_campaigns (workspace_id, status);

create table mkt_ads (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        not null references mkt_campaigns (id) on delete cascade,
  workspace_id    uuid        not null,
  tenant_id       uuid        not null,
  generated_ad_id uuid        references mkt_generated_ads (id) on delete set null,
  cloned_ad_id    uuid        references mkt_cloned_ads (id) on delete set null,
  headline        text,
  body_copy       text,
  cta             text,
  creative_url    text,
  destination_url text,
  status          text        not null default 'draft',
  platform_id     text,
  performance     jsonb       not null default '{}',
  synced_at       timestamptz,
  created_by      uuid        not null,
  created_at      timestamptz not null default now(),

  constraint mkt_ads_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_ads_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_ads_status_check
    check (status in ('draft', 'pending_approval', 'approved', 'active', 'paused', 'archived'))
);

create index mkt_ads_campaign_idx on mkt_ads (campaign_id);
create index mkt_ads_workspace_idx on mkt_ads (workspace_id);

create table mkt_ad_integrations (
  id               uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        not null,
  tenant_id        uuid        not null,
  platform         text        not null,
  account_id       text,
  account_name     text,
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes           text[]      not null default '{}',
  status           text        not null default 'pending',
  last_synced_at   timestamptz,
  metadata         jsonb       not null default '{}',
  created_by       uuid        not null,
  created_at       timestamptz not null default now(),

  constraint mkt_integrations_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_integrations_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_integrations_platform_check
    check (platform in ('meta', 'google', 'tiktok', 'linkedin')),
  constraint mkt_integrations_status_check
    check (status in ('pending', 'connected', 'error', 'disconnected')),
  constraint mkt_integrations_unique unique (workspace_id, platform)
);

create index mkt_integrations_workspace_idx on mkt_ad_integrations (workspace_id);

-- ── rls ───────────────────────────────────────────────────────────────────────

alter table mkt_campaigns       enable row level security;
alter table mkt_campaigns       force row level security;
alter table mkt_ads             enable row level security;
alter table mkt_ads             force row level security;
alter table mkt_ad_integrations enable row level security;
alter table mkt_ad_integrations force row level security;

create policy "mkt_campaigns_select" on mkt_campaigns for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_campaigns_insert" on mkt_campaigns for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_campaigns_update" on mkt_campaigns for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_campaigns_delete" on mkt_campaigns for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "mkt_ads_select" on mkt_ads for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ads_insert" on mkt_ads for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ads_update" on mkt_ads for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ads_delete" on mkt_ads for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "mkt_integrations_select" on mkt_ad_integrations for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_integrations_insert" on mkt_ad_integrations for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_integrations_update" on mkt_ad_integrations for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_integrations_delete" on mkt_ad_integrations for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
