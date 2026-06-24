-- M015: invoices + invoice_line_items
-- Decision #5: invoice_line_items is a separate table (not JSONB array)
-- invoice_line_items carries denormalized tenant_id for RLS performance
-- The trigger in M021 enforces invoice_line_items.tenant_id == invoices.tenant_id

-- ── invoices ──────────────────────────────────────────────────────────────────
create table invoices (
  id                  uuid           primary key,
  tenant_id           uuid           not null,
  billing_account_id  uuid           not null,
  status              invoice_status not null default 'draft',
  total_amount        numeric(19, 4) not null,
  total_currency      text           not null,
  due_date            date           not null,
  paid_at             timestamptz,
  version             integer        not null default 1,
  metadata            jsonb          not null default '{}',
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now(),
  deleted_at          timestamptz,

  constraint invoices_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint invoices_billing_account_fk
    foreign key (billing_account_id) references billing_accounts (id) on delete restrict,

  constraint invoices_total_positive
    check (total_amount >= 0)
);

create index invoices_tenant_id_idx on invoices (tenant_id);
create index invoices_billing_account_status_idx
  on invoices (billing_account_id, status);

alter table invoices enable row level security;
alter table invoices force row level security;

create policy "invoices_select"
  on invoices for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "invoices_insert"
  on invoices for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "invoices_update"
  on invoices for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── invoice_line_items ────────────────────────────────────────────────────────
create table invoice_line_items (
  id                  uuid           primary key,
  invoice_id          uuid           not null,
  tenant_id           uuid           not null,
  description         text           not null,
  quantity            integer        not null,
  unit_price_amount   numeric(19, 4) not null,
  unit_price_currency text           not null,
  sort_order          integer        not null default 0,

  constraint invoice_line_items_invoice_fk
    foreign key (invoice_id) references invoices (id) on delete cascade,
  constraint invoice_line_items_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,

  constraint invoice_line_items_quantity_positive
    check (quantity > 0),
  constraint invoice_line_items_unit_price_positive
    check (unit_price_amount >= 0)
);

create index invoice_line_items_invoice_id_idx on invoice_line_items (invoice_id);
create index invoice_line_items_tenant_id_idx on invoice_line_items (tenant_id);

alter table invoice_line_items enable row level security;
alter table invoice_line_items force row level security;

-- Line items are written by the service layer (aggregate invariant);
-- authenticated users can read their own tenant's line items
create policy "invoice_line_items_select"
  on invoice_line_items for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- INSERT/UPDATE/DELETE denied for authenticated — handled by service role only
