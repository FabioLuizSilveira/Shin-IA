-- Blueprint Runtime — tenant installations of packages/blueprint-runtime's
-- built-in blueprints (asset-type templates). No manifest table: the
-- registry is seeded in-memory from BUILT_IN_BLUEPRINTS at runtime
-- (confirmed manifestRepo is never actually used by the package for this —
-- see packages/blueprint-runtime audit), so only the per-tenant install
-- record needs persistence.

create table if not exists blueprint_instances (
  id                uuid          primary key default gen_random_uuid(),
  tenant_id         uuid          not null,
  blueprint_id      text          not null,
  blueprint_version text          not null,
  config            jsonb         not null default '{}',
  status            text          not null default 'active',
  installed_at      timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  installed_by      uuid          not null,

  constraint blueprint_instances_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint blueprint_instances_status_check
    check (status in ('installing', 'active', 'error', 'uninstalling'))
);

create unique index blueprint_instances_tenant_blueprint_unique
  on blueprint_instances (tenant_id, blueprint_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Same posture as studio_drafts/studio_versions: select-only for tenant
-- staff, writes go through the service-role admin client (requireTenantScope).
alter table blueprint_instances enable row level security;
alter table blueprint_instances force row level security;

create policy "blueprint_instances_select"
  on blueprint_instances for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
