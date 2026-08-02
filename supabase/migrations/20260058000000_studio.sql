-- Shinã Studio — generic persistence for packages/studio's StudioRuntime.
-- StudioRuntime already models all 10 customization domains (branding,
-- workflow, rule, access_control, dashboard, forms, blueprint, integration,
-- notification, commercial) through ONE draft/publish/version model keyed
-- by studio_type — so this is two generic tables, not ten. Only the UI per
-- domain is actually domain-specific (see apps/web/src/app/(tenant)/tenant/
-- customization).

create table if not exists studio_drafts (
  id          uuid          primary key default gen_random_uuid(),
  tenant_id   uuid          not null,
  studio_type text          not null,
  config      jsonb         not null default '{}',
  updated_at  timestamptz   not null default now(),
  updated_by  uuid          not null,

  constraint studio_drafts_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create unique index studio_drafts_tenant_type_unique
  on studio_drafts (tenant_id, studio_type);

create table if not exists studio_versions (
  id           uuid          primary key default gen_random_uuid(),
  tenant_id    uuid          not null,
  studio_type  text          not null,
  version      integer       not null,
  config       jsonb         not null default '{}',
  published_at timestamptz   not null default now(),
  published_by uuid          not null,
  changelog    text,

  constraint studio_versions_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create unique index studio_versions_tenant_type_version_unique
  on studio_versions (tenant_id, studio_type, version);
create index studio_versions_tenant_type_idx
  on studio_versions (tenant_id, studio_type, version desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Same posture as tenant_activity_log/commission_*: select-only for tenant
-- staff, writes go through the service-role admin client (requireTenantScope).
alter table studio_drafts enable row level security;
alter table studio_drafts force row level security;

create policy "studio_drafts_select"
  on studio_drafts for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

alter table studio_versions enable row level security;
alter table studio_versions force row level security;

create policy "studio_versions_select"
  on studio_versions for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
