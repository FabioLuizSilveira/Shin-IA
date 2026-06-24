-- M017: workflow_definitions + workflow_steps
-- Decision #6: workflow_steps is a separate table (not JSONB) to enable self-ref FK
-- workflow_steps carries denormalized tenant_id for RLS performance
-- next_step_id is a self-referential FK; ON DELETE SET NULL breaks chain safely

-- ── workflow_definitions ──────────────────────────────────────────────────────
create table workflow_definitions (
  id         uuid            primary key,
  tenant_id  uuid            not null,
  name       text            not null,
  trigger    text            not null,
  status     workflow_status not null default 'draft',
  version    integer         not null default 1,
  metadata   jsonb           not null default '{}',
  created_at timestamptz     not null default now(),
  updated_at timestamptz     not null default now(),
  deleted_at timestamptz,

  constraint workflow_definitions_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,

  constraint workflow_definitions_version_positive
    check (version > 0)
);

create index workflow_definitions_tenant_id_idx on workflow_definitions (tenant_id);

alter table workflow_definitions enable row level security;
alter table workflow_definitions force row level security;

create policy "workflow_definitions_select"
  on workflow_definitions for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "workflow_definitions_insert"
  on workflow_definitions for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "workflow_definitions_update"
  on workflow_definitions for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── workflow_steps ────────────────────────────────────────────────────────────
create table workflow_steps (
  id                      uuid    primary key,
  workflow_definition_id  uuid    not null,
  tenant_id               uuid    not null,
  name                    text    not null,
  action                  text    not null,
  next_step_id            uuid,
  sort_order              integer not null default 0,

  constraint workflow_steps_definition_fk
    foreign key (workflow_definition_id) references workflow_definitions (id) on delete cascade,
  constraint workflow_steps_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint workflow_steps_next_step_fk
    foreign key (next_step_id) references workflow_steps (id) on delete set null
);

create index workflow_steps_definition_id_idx on workflow_steps (workflow_definition_id);
create index workflow_steps_tenant_id_idx on workflow_steps (tenant_id);

alter table workflow_steps enable row level security;
alter table workflow_steps force row level security;

create policy "workflow_steps_select"
  on workflow_steps for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "workflow_steps_insert"
  on workflow_steps for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "workflow_steps_update"
  on workflow_steps for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
