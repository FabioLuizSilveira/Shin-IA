-- Shinã Platform — Demo Seed Data
-- Idempotent: uses ON CONFLICT DO NOTHING with fixed UUIDs
-- Apply via: supabase db reset  OR  supabase db seed

-- Demo tenant
INSERT INTO tenants (id, name, slug, plan, status) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Acme Logística', 'acme-logistica', 'professional', 'active')
ON CONFLICT (id) DO NOTHING;

-- Demo branch (root)
INSERT INTO branches (id, tenant_id, name, scope_mode) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sede São Paulo', 'root')
ON CONFLICT (id) DO NOTHING;

-- Demo organizations (clients/suppliers)
INSERT INTO organizations (id, tenant_id, name, type, email) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Transportadora Silva', 'customer', 'contato@silva.com.br'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Distribuidora Norte', 'customer', 'norte@distribuidora.com.br'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Frota Express', 'partner', 'parceiro@frotaexpress.com.br')
ON CONFLICT (id) DO NOTHING;

-- Demo asset_types
INSERT INTO asset_types (id, tenant_id, name, category) VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Caminhão Baú', 'vehicle'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Van Cargo', 'vehicle'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Empilhadeira', 'equipment'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Scanner Industrial', 'technology')
ON CONFLICT (id) DO NOTHING;

-- Demo assets
INSERT INTO assets (id, tenant_id, branch_id, asset_type_id, name, serial_number, category, status) VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Caminhão ABC-1234', 'ABC-1234', 'vehicle', 'available'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Van DEF-5678', 'DEF-5678', 'vehicle', 'in_use'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'Empilhadeira GHI-9012', 'GHI-9012', 'equipment', 'maintenance'),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Caminhão JKL-3456', 'JKL-3456', 'vehicle', 'available')
ON CONFLICT (id) DO NOTHING;

-- Demo resources
INSERT INTO resources (id, tenant_id, branch_id, type, name, status) VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'human', 'João Motorista', 'available'),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'human', 'Maria Operadora', 'busy'),
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'vehicle', 'Rota SP-Norte', 'available')
ON CONFLICT (id) DO NOTHING;

-- Demo operations
INSERT INTO operations (id, tenant_id, branch_id, resource_id, type, status, scheduled_starts_at, scheduled_ends_at) VALUES
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'delivery', 'in_progress', now(), now() + interval '4 hours'),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'pickup', 'pending', now() + interval '2 hours', now() + interval '6 hours'),
  ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'maintenance', 'completed', now() - interval '2 days', now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'inspection', 'pending', now() + interval '1 day', now() + interval '1 day 3 hours')
ON CONFLICT (id) DO NOTHING;

-- Demo contracts
INSERT INTO contracts (id, tenant_id, organization_id, type, status, value_amount, value_currency, period_starts_at, period_ends_at) VALUES
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'service', 'active', 45000.00, 'BRL', now() - interval '30 days', now() + interval '335 days'),
  ('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'rental', 'active', 12500.00, 'BRL', now() - interval '60 days', now() + interval '120 days'),
  ('80000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'subscription', 'draft', 8900.00, 'BRL', now(), now() + interval '365 days')
ON CONFLICT (id) DO NOTHING;
