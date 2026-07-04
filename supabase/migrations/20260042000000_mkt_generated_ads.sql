-- M-MKT-03: ai-generated ads

create table mkt_generated_ads (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null,
  tenant_id     uuid        not null,
  brand_kit_id  uuid        references mkt_brand_kits (id) on delete set null,
  type          text        not null default 'static',
  platform      text,
  format        text        not null default '1080x1080',
  objective     text,
  brief         text,
  headline      text,
  body_copy     text,
  cta           text,
  image_prompt  text,
  variations    jsonb       not null default '[]',
  status        text        not null default 'generated',
  tokens_used   integer,
  model_used    text,
  created_by    uuid        not null,
  created_at    timestamptz not null default now(),

  constraint mkt_generated_ads_workspace_fk
    foreign key (workspace_id) references mkt_workspaces (id) on delete cascade,
  constraint mkt_generated_ads_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint mkt_generated_ads_status_check
    check (status in ('generated', 'edited', 'exported', 'published'))
);

create index mkt_generated_ads_workspace_idx on mkt_generated_ads (workspace_id, created_at desc);

alter table mkt_generated_ads enable row level security;
alter table mkt_generated_ads force row level security;

create policy "mkt_generated_ads_select" on mkt_generated_ads for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_generated_ads_insert" on mkt_generated_ads for insert to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_generated_ads_update" on mkt_generated_ads for update to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy "mkt_generated_ads_delete" on mkt_generated_ads for delete to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
