-- M-MKT-02: ad library, swipe files and competitor monitors.
-- entries are tenant-scoped: each workspace indexes the ads it captures.

create table mkt_ad_library_entries (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null,
  tenant_id     uuid        not null,
  platform      text        not null,
  brand_name    text        not null,
  brand_domain  text,
  creative_url  text,
  creative_type text        not null default 'image',
  headline      text,
  body_copy     text,
  cta           text,
  landing_url   text,
  country       text,
  language      text,
  started_at    date,
  last_seen_at  date,
  duration_days integer,
  raw_data      jsonb       not null default '{}',
  created_by    uuid        not null,
  created_at    timestamptz not null default now(),

  constraint mkt_ad_library_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_ad_library_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_ad_library_platform_check
    check (platform in ('meta', 'google', 'tiktok', 'linkedin', 'other')),
  constraint mkt_ad_library_type_check
    check (creative_type in ('image', 'video', 'carousel'))
);

create index mkt_ad_library_workspace_idx on mkt_ad_library_entries (workspace_id);
create index mkt_ad_library_brand_idx on mkt_ad_library_entries (workspace_id, brand_name);
create index mkt_ad_library_platform_idx on mkt_ad_library_entries (workspace_id, platform);

create table mkt_swipe_files (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null,
  tenant_id     uuid        not null,
  ad_library_id uuid        references mkt_ad_library_entries (id) on delete set null,
  custom_ad_url text,
  title         text,
  notes         text,
  tags          text[]      not null default '{}',
  folder        text,
  created_by    uuid        not null,
  created_at    timestamptz not null default now(),

  constraint mkt_swipe_files_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_swipe_files_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index mkt_swipe_files_workspace_idx on mkt_swipe_files (workspace_id, created_at desc);

create table mkt_competitor_monitors (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null,
  tenant_id       uuid        not null,
  brand_name      text        not null,
  brand_domain    text,
  platforms       text[]      not null default '{meta}',
  alert_new_ads   boolean     not null default true,
  last_checked_at timestamptz,
  created_by      uuid        not null,
  created_at      timestamptz not null default now(),

  constraint mkt_competitors_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_competitors_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_competitors_unique unique (workspace_id, brand_name)
);

create index mkt_competitors_workspace_idx on mkt_competitor_monitors (workspace_id);

-- ── rls ───────────────────────────────────────────────────────────────────────

alter table mkt_ad_library_entries  enable row level security;
alter table mkt_ad_library_entries  force row level security;
alter table mkt_swipe_files         enable row level security;
alter table mkt_swipe_files         force row level security;
alter table mkt_competitor_monitors enable row level security;
alter table mkt_competitor_monitors force row level security;

create policy "mkt_ad_library_select" on mkt_ad_library_entries for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ad_library_insert" on mkt_ad_library_entries for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ad_library_update" on mkt_ad_library_entries for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_ad_library_delete" on mkt_ad_library_entries for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "mkt_swipe_files_select" on mkt_swipe_files for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_swipe_files_insert" on mkt_swipe_files for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_swipe_files_delete" on mkt_swipe_files for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "mkt_competitors_select" on mkt_competitor_monitors for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_competitors_insert" on mkt_competitor_monitors for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_competitors_update" on mkt_competitor_monitors for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_competitors_delete" on mkt_competitor_monitors for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
