-- Real customer-paid reservations for the "switch to a different car"
-- renewal path: pick dates on a calendar, pay a 20% deposit to hold the
-- period, pay the 80% balance by the day before it starts or forfeit the
-- deposit. Money is real Stripe Checkout against the platform's own Stripe
-- account (no per-tenant Stripe Connect yet — confirmed product decision:
-- payout to the tenant is manual reconciliation for now, same posture as
-- the rest of this schema's "registro/controle" billing). Deposit/balance
-- are each a real row in the existing invoices table (Stripe checkout
-- already works there, see /api/invoices/[id]/checkout) — this table only
-- tracks the reservation itself and links to those two invoices.

create table if not exists rental_reservations (
  id                  uuid          primary key default gen_random_uuid(),
  tenant_id           uuid          not null,
  rental_customer_id  uuid          not null,
  organization_id     uuid          not null,
  asset_id            uuid          not null,
  period_starts_at    timestamptz   not null,
  period_ends_at      timestamptz   not null,
  total_amount        numeric(19, 4) not null,
  total_currency      text          not null default 'BRL',
  deposit_amount      numeric(19, 4) not null,
  balance_amount      numeric(19, 4) not null,
  deposit_invoice_id  uuid,
  balance_invoice_id  uuid,
  -- pending_deposit: created, deposit not yet paid.
  -- reserved: deposit paid, balance not yet paid, still within the window.
  -- completed: balance paid — a real contract now exists (contract_id set).
  -- forfeited: balance unpaid by period_starts_at - 1 day; deposit kept.
  -- cancelled: never got a paid deposit and expired/was abandoned.
  status              text          not null default 'pending_deposit'
    check (status in ('pending_deposit', 'reserved', 'completed', 'forfeited', 'cancelled')),
  contract_id         uuid,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),

  constraint rental_reservations_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint rental_reservations_customer_fk
    foreign key (rental_customer_id) references rental_customers (id) on delete cascade,
  constraint rental_reservations_organization_fk
    foreign key (organization_id) references organizations (id) on delete cascade,
  constraint rental_reservations_asset_fk
    foreign key (asset_id) references assets (id) on delete restrict,
  constraint rental_reservations_deposit_invoice_fk
    foreign key (deposit_invoice_id) references invoices (id) on delete set null,
  constraint rental_reservations_balance_invoice_fk
    foreign key (balance_invoice_id) references invoices (id) on delete set null,
  constraint rental_reservations_contract_fk
    foreign key (contract_id) references contracts (id) on delete set null,
  constraint rental_reservations_period_range
    check (period_starts_at < period_ends_at)
);

create index rental_reservations_tenant_id_idx on rental_reservations (tenant_id);
create index rental_reservations_asset_id_idx on rental_reservations (asset_id);
create index rental_reservations_customer_id_idx on rental_reservations (rental_customer_id);

-- Overlap guard mirrors operations_no_asset_overlap (20260066000000) — only
-- live holds (deposit paid or awaiting payment) block a date range; a
-- forfeited/cancelled/completed reservation never conflicts with a new one.
create extension if not exists "btree_gist" with schema extensions;

alter table rental_reservations
  add constraint rental_reservations_no_overlap
  exclude using gist (
    asset_id with =,
    tstzrange(period_starts_at, period_ends_at) with &&
  )
  where (status in ('pending_deposit', 'reserved'));

alter table rental_reservations enable row level security;
alter table rental_reservations force row level security;

create policy "rental_reservations_select_tenant"
  on rental_reservations for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "rental_reservations_select_rental_customer"
  on rental_reservations for select
  to authenticated
  using (
    rental_customer_id in (
      select rc.id from rental_customers rc where rc.auth_user_id = auth.uid()
    )
  );

-- INSERT/UPDATE done by the service role only (mobile customer routes use
-- requireMobileContext()'s admin client, same posture as the rest of the
-- mobile API — never a raw client insert under RLS for money-moving rows).
