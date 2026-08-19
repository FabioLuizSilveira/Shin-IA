-- Expands the Veloz Rent a Car demo tenant (seeded in
-- 20260064000000_car_rental_demo_reseed.sql) to 8 cars / 4 clients / 6
-- months of financial + maintenance history, per explicit product request.
-- Car photos use the same public Unsplash URLs the Emergent frontend's own
-- mock fleet used (frontend/src/mocks/data.ts on
-- origin/feat/emergent-mobile-integration) — this is a direct visual-parity
-- restoration, not new asset selection. Vehicle rental has no operator
-- concept (self-drive rental, unlike the crane/forklift/munk blueprints,
-- which do use packages/blueprint-runtime's requires_certified_operator
-- field) — confirmed already true in this schema (rental-cars/mobility only
-- map to the vehicle_rental contract template in
-- 20260078000000_blueprint_contract_mappings_seed.sql, never to
-- equipment_with_operator), so no operator rows are seeded for this tenant.

-- ── Car photos for the 5 cars seeded in the car-rental reseed ──────────────────
update assets set metadata = metadata || '{"photo_url": "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000005'; -- Chevrolet Onix
update assets set metadata = metadata || '{"photo_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=400"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000006'; -- Volkswagen Polo
update assets set metadata = metadata || '{"photo_url": "https://images.unsplash.com/photo-1541348263662-e068662d82af?w=400"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000007'; -- Hyundai HB20
update assets set metadata = metadata || '{"photo_url": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000008'; -- Jeep Compass
update assets set metadata = metadata || '{"photo_url": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000009'; -- BMW 320i

-- Volkswagen Polo becomes the 4th customer's active rental below.
update assets set status = 'in_use' where id = '50000000-0000-0000-0000-000000000006';

-- ── 3 more cars to reach 8 (matching the Emergent mock fleet's remaining models) ──
insert into assets (id, tenant_id, branch_id, asset_type_id, name, serial_number, category, status, metadata) values
  ('5000000a-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005',
   'Volkswagen Voyage', 'FGH6I78', 'vehicle', 'available',
   '{"plate": "FGH6I78", "brand": "Volkswagen", "model": "Voyage", "year": 2022, "transmission": "manual", "seats": 5, "tier": "popular", "weekly_rate": 750.00, "photo_url": "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=400"}'::jsonb),
  ('5000000b-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005',
   'Toyota Corolla', 'GHI7J89', 'vehicle', 'in_use',
   '{"plate": "GHI7J89", "brand": "Toyota", "model": "Corolla", "year": 2023, "transmission": "automatic", "seats": 5, "tier": "luxury", "weekly_rate": 1000.00, "photo_url": "https://images.unsplash.com/photo-1623869675781-80aa31012a5a?w=400"}'::jsonb),
  ('5000000c-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005',
   'Honda Civic', 'HIJ8K90', 'vehicle', 'available',
   '{"plate": "HIJ8K90", "brand": "Honda", "model": "Civic", "year": 2023, "transmission": "automatic", "seats": 5, "tier": "luxury", "weekly_rate": 1000.00, "photo_url": "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400"}'::jsonb)
on conflict (id) do nothing;

-- ── photo_url as a recognized custom field on the asset type ───────────────────
update asset_types
set attributes = jsonb_set(
  attributes,
  '{customFields}',
  (attributes -> 'customFields') || '[{"key": "photo_url", "label": "Foto (URL)", "type": "text"}]'::jsonb
)
where id = '40000000-0000-0000-0000-000000000005'
  and not exists (
    select 1 from jsonb_array_elements(attributes -> 'customFields') f where f ->> 'key' = 'photo_url'
  );

-- ── 2 more customers to reach 4 ─────────────────────────────────────────────────
insert into organizations (id, tenant_id, name, document, type, email, address_city, address_state, address_country) values
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Camila Andrade Santos', '456.789.123-00', 'customer', 'camila.andrade@example.com', 'São Paulo', 'SP', 'BR'),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Marcos Paulo Vieira', '789.123.456-00', 'customer', 'marcos.vieira@example.com', 'São Paulo', 'SP', 'BR')
on conflict (id) do nothing;

-- ── active rental contracts for the 2 new customers ─────────────────────────────
insert into contracts (id, tenant_id, organization_id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, metadata) values
  ('80000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006',
   'rental', 'active', 750.00, 'BRL', now(), now() + interval '7 days',
   '{"vehicle_tier": "popular", "weekly_rate": 750.00}'::jsonb),
  ('80000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007',
   'rental', 'active', 1000.00, 'BRL', now(), now() + interval '7 days',
   '{"vehicle_tier": "luxury", "weekly_rate": 1000.00}'::jsonb)
on conflict (id) do nothing;

insert into contract_assets (tenant_id, contract_id, asset_id, quantity) values
  ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000006', 1),
  ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000007', '5000000b-0000-0000-0000-000000000001', 1)
on conflict (contract_id, asset_id) do nothing;

insert into billing_accounts (id, tenant_id, organization_id, cycle, status, credit_limit_amount, credit_limit_currency, balance_amount, balance_currency) values
  ('a0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'one_time', 'active', 5000.00, 'BRL', 2250.00, 'BRL'),
  ('a0000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 'one_time', 'active', 5000.00, 'BRL', 3500.00, 'BRL')
on conflict (id) do nothing;

insert into invoices (id, tenant_id, billing_account_id, status, total_amount, total_currency, due_date, paid_at) values
  ('b0000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'issued', 2250.00, 'BRL', current_date, null),
  ('b0000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'issued', 3500.00, 'BRL', current_date, null)
on conflict (id) do nothing;

insert into invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price_amount, unit_price_currency, sort_order) values
  ('c0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Locação semanal - Volkswagen Polo', 1, 750.00, 'BRL', 0),
  ('c0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Caução (garantia, reembolsável)', 1, 1500.00, 'BRL', 1),
  ('c0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Locação semanal - Toyota Corolla', 1, 1000.00, 'BRL', 0),
  ('c0000000-0000-0000-0000-00000000000d', 'b0000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Caução (garantia, reembolsável)', 1, 2500.00, 'BRL', 1)
on conflict (id) do nothing;

insert into contract_deposits (tenant_id, contract_id, amount, currency, status, invoice_line_item_id, held_at) values
  ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000006', 1500.00, 'BRL', 'invoiced', 'c0000000-0000-0000-0000-00000000000b', now()),
  ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000007', 2500.00, 'BRL', 'invoiced', 'c0000000-0000-0000-0000-00000000000d', now())
on conflict (contract_id) do nothing;

-- ── 6 months of historical movement: one completed rental cycle/month
-- (financial) cycling through the 4 clients and 8 cars, plus one completed
-- maintenance operation per car spread across the same window ────────────────
do $$
declare
  v_tenant   uuid := '10000000-0000-0000-0000-000000000001';
  v_branch   uuid := '20000000-0000-0000-0000-000000000001';
  v_customers uuid[] := array[
    '30000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000007'
  ];
  v_assets uuid[] := array[
    '50000000-0000-0000-0000-000000000005',
    '50000000-0000-0000-0000-000000000006',
    '50000000-0000-0000-0000-000000000007',
    '50000000-0000-0000-0000-000000000008',
    '50000000-0000-0000-0000-000000000009',
    '5000000a-0000-0000-0000-000000000001',
    '5000000b-0000-0000-0000-000000000001',
    '5000000c-0000-0000-0000-000000000001'
  ];
  v_rates numeric[] := array[750, 750, 750, 1000, 1000, 750, 1000, 1000];
  v_month int;
  v_customer uuid;
  v_asset uuid;
  v_rate numeric;
  v_deposit numeric;
  v_contract_id uuid;
  v_billing_account_id uuid;
  v_invoice_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_maint_at timestamptz;
begin
  for v_month in 1..6 loop
    v_customer := v_customers[((v_month - 1) % array_length(v_customers, 1)) + 1];
    v_asset := v_assets[((v_month - 1) % array_length(v_assets, 1)) + 1];
    v_rate := v_rates[((v_month - 1) % array_length(v_rates, 1)) + 1];
    v_deposit := v_rate * 2;
    v_period_start := now() - (v_month || ' months')::interval;
    v_period_end := v_period_start + interval '7 days';
    v_contract_id := gen_random_uuid();

    insert into contracts (id, tenant_id, organization_id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, metadata)
    values (v_contract_id, v_tenant, v_customer, 'rental', 'expired', v_rate, 'BRL', v_period_start, v_period_end,
      jsonb_build_object('weekly_rate', v_rate, 'historical', true));

    insert into contract_assets (tenant_id, contract_id, asset_id, quantity)
    values (v_tenant, v_contract_id, v_asset, 1)
    on conflict (contract_id, asset_id) do nothing;

    v_billing_account_id := gen_random_uuid();
    insert into billing_accounts (id, tenant_id, organization_id, cycle, status, credit_limit_amount, credit_limit_currency, balance_amount, balance_currency)
    values (v_billing_account_id, v_tenant, v_customer, 'one_time', 'active', 5000, 'BRL', v_rate + v_deposit, 'BRL');

    v_invoice_id := gen_random_uuid();
    insert into invoices (id, tenant_id, billing_account_id, status, total_amount, total_currency, due_date, paid_at)
    values (v_invoice_id, v_tenant, v_billing_account_id, 'paid', v_rate + v_deposit, 'BRL', v_period_start::date, v_period_end);

    insert into invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price_amount, unit_price_currency, sort_order)
    values
      (gen_random_uuid(), v_invoice_id, v_tenant, 'Locação semanal', 1, v_rate, 'BRL', 0),
      (gen_random_uuid(), v_invoice_id, v_tenant, 'Caução (garantia, reembolsável)', 1, v_deposit, 'BRL', 1);

    insert into contract_deposits (tenant_id, contract_id, amount, currency, status, held_at, refunded_at, refunded_amount)
    values (v_tenant, v_contract_id, v_deposit, 'BRL', 'refunded', v_period_start, v_period_end, v_deposit);
  end loop;

  -- One completed maintenance operation per car, spread across the same 6-month window.
  for v_month in 1..array_length(v_assets, 1) loop
    v_asset := v_assets[v_month];
    v_maint_at := now() - ((((v_month - 1) % 6) + 1) || ' months')::interval + interval '2 days';

    insert into operations (id, tenant_id, branch_id, asset_id, type, status, scheduled_starts_at, scheduled_ends_at, started_at, completed_at, metadata)
    values (
      gen_random_uuid(), v_tenant, v_branch, v_asset, 'maintenance', 'completed',
      v_maint_at, v_maint_at + interval '3 hours', v_maint_at, v_maint_at + interval '3 hours',
      jsonb_build_object('description', 'Revisão preventiva')
    );
  end loop;
end $$;
