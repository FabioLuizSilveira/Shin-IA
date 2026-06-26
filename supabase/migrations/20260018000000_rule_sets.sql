-- M018: rule_sets + rule_set_rules
-- Decision #6: rule_set_rules is a separate table (not JSONB) to enable priority ordering
-- rule_set_rules carries denormalized tenant_id for RLS performance

-- ── rule_sets ─────────────────────────────────────────────────────────────────
create table rule_sets (
  id         uuid            primary key,
  tenant_id  uuid            not null,
  name       text            not null,
  context    text            not null,
  status     rule_set_status not null default 'draft',
  version    integer         not null default 1,
  metadata   jsonb           not null default '{}',
  created_at timestamptz     not null default now(),
  updated_at timestamptz     not null default now(),
  deleted_at timestamptz,

  constraint rule_sets_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict
);

create index rule_sets_tenant_id_idx on rule_sets (tenant_id);

alter table rule_sets enable row level security;
alter table rule_sets force row level security;

create policy "rule_sets_select"
  on rule_sets for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "rule_sets_insert"
  on rule_sets for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "rule_sets_update"
  on rule_sets for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── rule_set_rules ────────────────────────────────────────────────────────────
create table rule_set_rules (
  id           uuid    primary key,
  rule_set_id  uuid    not null,
  tenant_id    uuid    not null,
  condition    text    not null,
  action       text    not null,
  priority     integer not null default 0,

  constraint rule_set_rules_rule_set_fk
    foreign key (rule_set_id) references rule_sets (id) on delete cascade,
  constraint rule_set_rules_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,

  constraint rule_set_rules_priority_positive
    check (priority >= 0)
);

create index rule_set_rules_rule_set_id_idx on rule_set_rules (rule_set_id);
create index rule_set_rules_tenant_id_idx on rule_set_rules (tenant_id);

alter table rule_set_rules enable row level security;
alter table rule_set_rules force row level security;

create policy "rule_set_rules_select"
  on rule_set_rules for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "rule_set_rules_insert"
  on rule_set_rules for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "rule_set_rules_update"
  on rule_set_rules for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
