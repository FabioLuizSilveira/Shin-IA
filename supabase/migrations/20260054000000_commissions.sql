-- Commission management — plans, rules, campaigns, targets, transactions,
-- settlements and approvals. Schema mirrors packages/commission-engine's
-- domain types 1:1 (that package has a fully tested calculator/service but
-- was never wired to real tables) — this migration is the missing
-- persistence layer for it.

create type commission_plan_status as enum ('active', 'inactive', 'archived');
create type commission_calculation_type as enum ('flat', 'percentage', 'tiered');
create type commission_period as enum ('daily', 'weekly', 'monthly', 'quarterly', 'annual');

create table if not exists commission_plans (
  id                uuid          primary key default gen_random_uuid(),
  tenant_id         uuid          not null,
  name              text          not null,
  description       text,
  calculation_type  commission_calculation_type not null default 'percentage',
  base_rate         numeric(10, 6) not null default 0,
  tiers             jsonb         not null default '[]', -- [{minAmount,maxAmount,rate}]
  currency          text          not null default 'BRL',
  period            commission_period not null default 'monthly',
  status            commission_plan_status not null default 'active',
  effective_from    date          not null default current_date,
  effective_until   date,
  version           integer       not null default 1,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  deleted_at        timestamptz,

  constraint commission_plans_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index commission_plans_tenant_id_idx on commission_plans (tenant_id);

create type commission_rule_condition_type as enum (
  'revenue_threshold', 'operation_count', 'resource_type', 'branch', 'always'
);

create table if not exists commission_rules (
  id               uuid          primary key default gen_random_uuid(),
  plan_id          uuid          not null,
  tenant_id        uuid          not null,
  name             text          not null,
  priority         integer       not null default 0,
  condition_type   commission_rule_condition_type not null default 'always',
  condition_value  jsonb         not null default 'null',
  rate_override    numeric(10, 6),
  bonus_amount     numeric(14, 2),
  is_active        boolean       not null default true,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),

  constraint commission_rules_plan_fk
    foreign key (plan_id) references commission_plans (id) on delete cascade,
  constraint commission_rules_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index commission_rules_plan_id_idx on commission_rules (plan_id);
create index commission_rules_tenant_id_idx on commission_rules (tenant_id);

create type commission_campaign_status as enum (
  'draft', 'active', 'paused', 'completed', 'cancelled'
);

create table if not exists commission_campaigns (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           uuid        not null,
  plan_id             uuid        not null,
  name                text        not null,
  description         text,
  status              commission_campaign_status not null default 'draft',
  start_date          date        not null,
  end_date            date        not null,
  bonus_rate          numeric(10, 6) not null default 0,
  max_payout          numeric(14, 2),
  eligible_branch_ids uuid[]      not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint commission_campaigns_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint commission_campaigns_plan_fk
    foreign key (plan_id) references commission_plans (id) on delete cascade,
  constraint commission_campaigns_date_range check (start_date <= end_date)
);

create index commission_campaigns_tenant_id_idx on commission_campaigns (tenant_id);
create index commission_campaigns_plan_id_idx on commission_campaigns (plan_id);

create type commission_target_status as enum ('pending', 'achieved', 'missed', 'partial');

create table if not exists commission_targets (
  id                 uuid         primary key default gen_random_uuid(),
  tenant_id          uuid         not null,
  plan_id            uuid         not null,
  branch_id          uuid         not null,
  period             commission_period not null,
  period_start       date         not null,
  period_end         date         not null,
  target_revenue     numeric(14, 2) not null,
  target_operations  integer,
  achieved_revenue   numeric(14, 2) not null default 0,
  achieved_operations integer     not null default 0,
  status             commission_target_status not null default 'pending',
  currency           text         not null default 'BRL',
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),

  constraint commission_targets_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint commission_targets_plan_fk
    foreign key (plan_id) references commission_plans (id) on delete cascade,
  constraint commission_targets_branch_fk
    foreign key (branch_id) references branches (id) on delete cascade
);

create unique index commission_targets_branch_plan_period_unique
  on commission_targets (branch_id, plan_id, period_start);
create index commission_targets_tenant_id_idx on commission_targets (tenant_id);

create type commission_transaction_status as enum ('pending', 'approved', 'rejected', 'paid');
create type commission_transaction_type as enum ('earned', 'bonus', 'adjustment', 'reversal');

create table if not exists commission_transactions (
  id                uuid         primary key default gen_random_uuid(),
  tenant_id         uuid         not null,
  branch_id         uuid         not null,
  plan_id           uuid         not null,
  campaign_id       uuid,
  target_id         uuid,
  operation_id      uuid,
  type              commission_transaction_type not null default 'earned',
  gross_revenue     numeric(14, 2) not null default 0,
  commission_rate   numeric(10, 6) not null default 0,
  commission_amount numeric(14, 2) not null default 0,
  bonus_amount      numeric(14, 2) not null default 0,
  total_amount      numeric(14, 2) not null default 0,
  currency          text         not null default 'BRL',
  status            commission_transaction_status not null default 'pending',
  period            commission_period not null,
  period_start      date         not null,
  period_end        date         not null,
  notes             text,
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),

  constraint commission_transactions_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint commission_transactions_branch_fk
    foreign key (branch_id) references branches (id) on delete cascade,
  constraint commission_transactions_plan_fk
    foreign key (plan_id) references commission_plans (id) on delete cascade,
  constraint commission_transactions_campaign_fk
    foreign key (campaign_id) references commission_campaigns (id) on delete set null,
  constraint commission_transactions_target_fk
    foreign key (target_id) references commission_targets (id) on delete set null,
  constraint commission_transactions_operation_fk
    foreign key (operation_id) references operations (id) on delete set null
);

create index commission_transactions_tenant_id_idx on commission_transactions (tenant_id);
create index commission_transactions_branch_id_idx on commission_transactions (branch_id);
create index commission_transactions_status_idx on commission_transactions (status);

create type commission_settlement_status as enum ('pending', 'processing', 'completed', 'failed');

create table if not exists commission_settlements (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          uuid        not null,
  branch_id          uuid        not null,
  transaction_ids    uuid[]      not null default '{}',
  total_amount       numeric(14, 2) not null default 0,
  currency           text        not null default 'BRL',
  status             commission_settlement_status not null default 'pending',
  scheduled_at       timestamptz not null,
  processed_at       timestamptz,
  failed_at          timestamptz,
  failure_reason     text,
  external_reference text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint commission_settlements_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint commission_settlements_branch_fk
    foreign key (branch_id) references branches (id) on delete cascade
);

create index commission_settlements_tenant_id_idx on commission_settlements (tenant_id);
create index commission_settlements_branch_id_idx on commission_settlements (branch_id);

create type commission_approval_status as enum ('pending', 'approved', 'rejected');
create type commission_approval_decision as enum ('approve', 'reject');

create table if not exists commission_approvals (
  id             uuid          primary key default gen_random_uuid(),
  tenant_id      uuid          not null,
  transaction_id uuid          not null,
  status         commission_approval_status not null default 'pending',
  requested_by   uuid          not null,
  requested_at   timestamptz   not null default now(),
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  decision       commission_approval_decision,
  notes          text,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),

  constraint commission_approvals_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint commission_approvals_transaction_fk
    foreign key (transaction_id) references commission_transactions (id) on delete cascade
);

create unique index commission_approvals_transaction_unique
  on commission_approvals (transaction_id);
create index commission_approvals_tenant_id_idx on commission_approvals (tenant_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Every route in this module goes through requireTenantScope() (admin
-- client + explicit tenant_id filter, same as every other tenant-scoped
-- module built this session) — RLS here is defense-in-depth, matching the
-- narrow-select / service-role-write posture used for impersonation_sessions
-- and platform_billing_events.

do $$
declare
  t text;
begin
  foreach t in array array[
    'commission_plans', 'commission_rules', 'commission_campaigns',
    'commission_targets', 'commission_transactions', 'commission_settlements',
    'commission_approvals'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy "%s_select_own_tenant" on %I for select to authenticated using (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)',
      t, t
    );
  end loop;
end $$;
