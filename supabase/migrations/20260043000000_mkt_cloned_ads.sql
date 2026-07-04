-- M-MKT-04: cloned ads — reference ad analyzed by vision ai and
-- adapted to the workspace brand

create table mkt_cloned_ads (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null,
  tenant_id       uuid        not null,
  brand_kit_id    uuid        references mkt_brand_kits (id) on delete set null,
  source_type     text        not null default 'url',
  source_url      text,
  source_ad_id    uuid        references mkt_ad_library_entries (id) on delete set null,
  detected_layout jsonb       not null default '{}',
  adapted_headline text,
  adapted_body    text,
  adapted_cta     text,
  image_prompt    text,
  notes           text,
  status          text        not null default 'draft',
  tokens_used     integer,
  model_used      text,
  created_by      uuid        not null,
  created_at      timestamptz not null default now(),

  constraint mkt_cloned_ads_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_cloned_ads_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_cloned_ads_source_check
    check (source_type in ('url', 'library', 'upload', 'extension')),
  constraint mkt_cloned_ads_status_check
    check (status in ('draft', 'edited', 'exported'))
);

create index mkt_cloned_ads_workspace_idx on mkt_cloned_ads (workspace_id, created_at desc);

alter table mkt_cloned_ads enable row level security;
alter table mkt_cloned_ads force row level security;

create policy "mkt_cloned_ads_select" on mkt_cloned_ads for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_cloned_ads_insert" on mkt_cloned_ads for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_cloned_ads_update" on mkt_cloned_ads for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_cloned_ads_delete" on mkt_cloned_ads for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
