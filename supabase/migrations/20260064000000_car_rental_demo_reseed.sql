-- Reseeds the demo tenant ("Acme Logística" -> car rental company) and adds
-- contract_deposits (caução/security deposit tracking per rental contract).
-- All demo business data for this tenant is logistics-themed (trucks,
-- forklifts, delivery operations) and is being fully replaced with a car
-- rental fleet per explicit product decision — this tenant exists purely to
-- showcase the platform, not as a real customer's records.

-- ── contract_deposits: caução held against a rental contract ───────────────────
create table if not exists contract_deposits (
  id                    uuid           primary key default gen_random_uuid(),
  tenant_id             uuid           not null,
  contract_id           uuid           not null,
  amount                numeric(19, 4) not null,
  currency              text           not null default 'BRL',
  status                text           not null default 'pending'
    check (status in ('pending', 'invoiced', 'held', 'refunded', 'partially_refunded', 'forfeited')),
  invoice_line_item_id  uuid,
  held_at               timestamptz,
  refunded_at           timestamptz,
  refunded_amount       numeric(19, 4),
  notes                 text,
  metadata              jsonb          not null default '{}',
  created_at            timestamptz    not null default now(),
  updated_at            timestamptz    not null default now(),

  constraint contract_deposits_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint contract_deposits_contract_fk
    foreign key (contract_id) references contracts (id) on delete cascade,
  constraint contract_deposits_invoice_line_item_fk
    foreign key (invoice_line_item_id) references invoice_line_items (id) on delete set null,
  constraint contract_deposits_amount_positive
    check (amount >= 0),
  constraint contract_deposits_contract_unique
    unique (contract_id)
);

create index if not exists contract_deposits_tenant_id_idx on contract_deposits (tenant_id);
create index if not exists contract_deposits_contract_id_idx on contract_deposits (contract_id);

alter table contract_deposits enable row level security;
alter table contract_deposits force row level security;

drop policy if exists "contract_deposits_select" on contract_deposits;
create policy "contract_deposits_select"
  on contract_deposits for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- INSERT/UPDATE/DELETE denied for authenticated — written by service role only,
-- same pattern as invoice_line_items.

-- ── Wipe the demo tenant's logistics-themed business data ──────────────────────
delete from invoice_line_items where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from invoices where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from billing_accounts where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from contract_assets where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from contract_deposits where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from contracts where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from notifications where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from operations where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from resources where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from assets where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from asset_types where tenant_id = '10000000-0000-0000-0000-000000000001';
delete from organizations where tenant_id = '10000000-0000-0000-0000-000000000001';

-- ── Rebrand the tenant as a car rental company ──────────────────────────────────
update tenants
set name = 'Veloz Rent a Car', slug = 'veloz-rent-a-car'
where id = '10000000-0000-0000-0000-000000000001';

-- ── Asset type: passenger cars ───────────────────────────────────────────────────
insert into asset_types (id, tenant_id, name, category, attributes) values
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
   'Automóvel de Passeio', 'vehicle',
   '{"customFields": [
      {"key": "plate", "label": "Placa", "type": "text"},
      {"key": "brand", "label": "Marca", "type": "text"},
      {"key": "model", "label": "Modelo", "type": "text"},
      {"key": "year", "label": "Ano", "type": "number"},
      {"key": "transmission", "label": "Câmbio", "type": "select", "options": ["manual", "automatic"]},
      {"key": "seats", "label": "Lugares", "type": "number"},
      {"key": "tier", "label": "Categoria", "type": "select", "options": ["popular", "luxury"]},
      {"key": "weekly_rate", "label": "Diária/Semanal (R$)", "type": "number"}
   ]}'::jsonb)
on conflict (id) do nothing;

-- ── 5 cars: 3 popular (R$750/semana) + 2 de luxo (R$1.000/semana) ───────────────
insert into assets (id, tenant_id, branch_id, asset_type_id, name, serial_number, category, status, metadata) values
  ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005',
   'Chevrolet Onix', 'ABC1D23', 'vehicle', 'in_use',
   '{"plate": "ABC1D23", "brand": "Chevrolet", "model": "Onix", "year": 2023, "transmission": "manual", "seats": 5, "tier": "popular", "weekly_rate": 750.00}'::jsonb),
  ('50000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005',
   'Volkswagen Polo', 'BCD2E34', 'vehicle', 'available',
   '{"plate": "BCD2E34", "brand": "Volkswagen", "model": "Polo", "year": 2023, "transmission": "manual", "seats": 5, "tier": "popular", "weekly_rate": 750.00}'::jsonb),
  ('50000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005',
   'Hyundai HB20', 'CDE3F45', 'vehicle', 'available',
   '{"plate": "CDE3F45", "brand": "Hyundai", "model": "HB20", "year": 2022, "transmission": "automatic", "seats": 5, "tier": "popular", "weekly_rate": 750.00}'::jsonb),
  ('50000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005',
   'Jeep Compass', 'DEF4G56', 'vehicle', 'available',
   '{"plate": "DEF4G56", "brand": "Jeep", "model": "Compass", "year": 2023, "transmission": "automatic", "seats": 5, "tier": "luxury", "weekly_rate": 1000.00}'::jsonb),
  ('50000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005',
   'BMW 320i', 'EFG5H67', 'vehicle', 'in_use',
   '{"plate": "EFG5H67", "brand": "BMW", "model": "320i", "year": 2022, "transmission": "automatic", "seats": 5, "tier": "luxury", "weekly_rate": 1000.00}'::jsonb)
on conflict (id) do nothing;

-- ── 2 rental customers ───────────────────────────────────────────────────────────
insert into organizations (id, tenant_id, name, document, type, email, address_city, address_state, address_country) values
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Roberto Ferreira Souza', '123.456.789-00', 'customer', 'roberto.souza@example.com', 'São Paulo', 'SP', 'BR'),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Fernanda Lima Rodrigues', '987.654.321-00', 'customer', 'fernanda.lima@example.com', 'São Paulo', 'SP', 'BR')
on conflict (id) do nothing;

-- ── 2 active rental contracts (1 popular, 1 luxury) ─────────────────────────────
insert into contracts (id, tenant_id, organization_id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, metadata) values
  ('80000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004',
   'rental', 'active', 750.00, 'BRL', now(), now() + interval '7 days',
   '{"vehicle_tier": "popular", "weekly_rate": 750.00}'::jsonb),
  ('80000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005',
   'rental', 'active', 1000.00, 'BRL', now(), now() + interval '7 days',
   '{"vehicle_tier": "luxury", "weekly_rate": 1000.00}'::jsonb)
on conflict (id) do nothing;

insert into contract_assets (tenant_id, contract_id, asset_id, quantity) values
  ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000005', 1),
  ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000009', 1)
on conflict (contract_id, asset_id) do nothing;

-- ── Billing: one-time billing account per rental + invoice with rental fee + caução line ──
insert into billing_accounts (id, tenant_id, organization_id, cycle, status, credit_limit_amount, credit_limit_currency, balance_amount, balance_currency) values
  ('a0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'one_time', 'active', 5000.00, 'BRL', 2250.00, 'BRL'),
  ('a0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'one_time', 'active', 5000.00, 'BRL', 3500.00, 'BRL')
on conflict (id) do nothing;

insert into invoices (id, tenant_id, billing_account_id, status, total_amount, total_currency, due_date, paid_at) values
  ('b0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'issued', 2250.00, 'BRL', current_date, null),
  ('b0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'issued', 3500.00, 'BRL', current_date, null)
on conflict (id) do nothing;

insert into invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price_amount, unit_price_currency, sort_order) values
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Locação semanal - Chevrolet Onix', 1, 750.00, 'BRL', 0),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Caução (garantia, reembolsável)', 1, 1500.00, 'BRL', 1),
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Locação semanal - BMW 320i', 1, 1000.00, 'BRL', 0),
  ('c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Caução (garantia, reembolsável)', 1, 2500.00, 'BRL', 1)
on conflict (id) do nothing;

-- ── Deposit tracking rows, linked to the caução invoice line items above ────────
insert into contract_deposits (tenant_id, contract_id, amount, currency, status, invoice_line_item_id, held_at) values
  ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000004', 1500.00, 'BRL', 'invoiced', 'c0000000-0000-0000-0000-000000000007', now()),
  ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000005', 2500.00, 'BRL', 'invoiced', 'c0000000-0000-0000-0000-000000000009', now())
on conflict (contract_id) do nothing;
