-- Financial Entries -- a simple general ledger for expenses/revenue the
-- tenant records manually, distinct from `invoices` (which are only the
-- accounts-receivable side: charges issued TO a customer organization).
-- A real business also has costs (fuel, maintenance parts bought outside
-- a maintenance_order, rent, salaries) and revenue that never goes
-- through an invoice (cash sale, a one-off service) -- neither had
-- anywhere to be recorded before this.

create type financial_entry_type as enum ('expense', 'revenue');

create table if not exists financial_entries (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  type          financial_entry_type not null,
  description   text not null,
  category      text,
  amount_cents  bigint not null,
  currency      text not null default 'BRL',
  entry_date    date not null default current_date,
  notes         text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint financial_entries_amount_positive check (amount_cents > 0)
);

create index financial_entries_tenant_id_idx on financial_entries (tenant_id);
create index financial_entries_tenant_date_idx
  on financial_entries (tenant_id, entry_date desc) where deleted_at is null;

-- Same posture as commission_transactions/rental_rates etc.: every real
-- route goes through requireTenantScope() (admin client + explicit
-- tenant_id filter) -- RLS here is defense-in-depth, not the primary
-- mechanism, matching this table's siblings.
alter table financial_entries enable row level security;
alter table financial_entries force row level security;
create policy "financial_entries_select_own_tenant" on financial_entries
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
