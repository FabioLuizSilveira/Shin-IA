-- M014: billing_accounts — financial accounts linked to organizations
-- Money VOs: credit_limit + balance (no DEFAULT 'BRL' — Decision #9)

create table billing_accounts (
  id                     uuid                   primary key,
  tenant_id              uuid                   not null,
  organization_id        uuid                   not null,
  cycle                  billing_cycle          not null,
  status                 billing_account_status not null default 'active',
  credit_limit_amount    numeric(19, 4)         not null,
  credit_limit_currency  text                   not null,
  balance_amount         numeric(19, 4)         not null default 0,
  balance_currency       text                   not null,
  version                integer                not null default 1,
  metadata               jsonb                  not null default '{}',
  created_at             timestamptz            not null default now(),
  updated_at             timestamptz            not null default now(),
  deleted_at             timestamptz,

  constraint billing_accounts_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint billing_accounts_organization_fk
    foreign key (organization_id) references organizations (id) on delete restrict,

  constraint billing_accounts_credit_limit_positive
    check (credit_limit_amount >= 0),
  constraint billing_accounts_balance_positive
    check (balance_amount >= 0)
);

create index billing_accounts_tenant_id_idx on billing_accounts (tenant_id);
create index billing_accounts_organization_id_idx on billing_accounts (organization_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table billing_accounts enable row level security;
alter table billing_accounts force row level security;

create policy "billing_accounts_select"
  on billing_accounts for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "billing_accounts_insert"
  on billing_accounts for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "billing_accounts_update"
  on billing_accounts for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
