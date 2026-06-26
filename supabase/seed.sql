-- Shinã Platform — Demo Seed Data
-- Idempotent: uses ON CONFLICT DO NOTHING with fixed UUIDs

-- Demo tenant
INSERT INTO tenants (id, name, slug, plan, status) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Acme Logística', 'acme-logistica', 'professional', 'active')
ON CONFLICT (id) DO NOTHING;

-- Demo branch (root) — requires: code NOT NULL
INSERT INTO branches (id, tenant_id, name, code, scope_mode) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sede São Paulo', 'SP-001', 'root')
ON CONFLICT (id) DO NOTHING;

-- Demo organizations — requires: document, address_city, address_state NOT NULL
INSERT INTO organizations (id, tenant_id, name, document, type, email, address_city, address_state, address_country) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Transportadora Silva', '12.345.678/0001-90', 'customer', 'contato@silva.com.br', 'São Paulo', 'SP', 'BR'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Distribuidora Norte', '98.765.432/0001-10', 'customer', 'norte@distribuidora.com.br', 'Manaus', 'AM', 'BR'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Frota Express', '11.222.333/0001-44', 'partner', 'parceiro@frotaexpress.com.br', 'Campinas', 'SP', 'BR')
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

-- Demo in_app notifications (use ON CONFLICT DO NOTHING)
INSERT INTO notifications (id, tenant_id, recipient_external_ref, channel, priority, subject, body, status, created_at) VALUES
  ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'demo-user', 'in_app', 'high', 'Operação atrasada', 'A operação de entrega #DEL-001 está com 30 minutos de atraso.', 'pending', now() - interval '5 minutes'),
  ('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'demo-user', 'in_app', 'normal', 'Novo contrato assinado', 'Transportadora Silva assinou o contrato de serviço no valor de R$ 45.000.', 'pending', now() - interval '1 hour'),
  ('90000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'demo-user', 'in_app', 'low', 'Ativo disponível', 'Caminhão ABC-1234 está disponível para nova operação.', 'read', now() - interval '3 hours'),
  ('90000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'demo-user', 'in_app', 'critical', 'Manutenção programada', 'Empilhadeira GHI-9012 precisa de manutenção urgente.', 'pending', now() - interval '2 hours'),
  ('90000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'demo-user', 'in_app', 'normal', 'Recurso alocado', 'João Motorista foi alocado para a operação de pickup.', 'read', now() - interval '4 hours')
ON CONFLICT (id) DO NOTHING;

-- Demo billing_accounts
INSERT INTO billing_accounts (id, tenant_id, organization_id, cycle, status, credit_limit_amount, credit_limit_currency, balance_amount, balance_currency) VALUES
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'monthly', 'active', 50000.00, 'BRL', 12500.00, 'BRL'),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'quarterly', 'active', 25000.00, 'BRL', 0.00, 'BRL'),
  ('a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'monthly', 'suspended', 10000.00, 'BRL', 3200.00, 'BRL')
ON CONFLICT (id) DO NOTHING;

-- Demo invoices
INSERT INTO invoices (id, tenant_id, billing_account_id, status, total_amount, total_currency, due_date, paid_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'paid', 45000.00, 'BRL', (current_date - interval '5 days')::date, now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'issued', 12500.00, 'BRL', (current_date + interval '10 days')::date, null),
  ('b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'overdue', 8900.00, 'BRL', (current_date - interval '15 days')::date, null),
  ('b0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'draft', 3200.00, 'BRL', (current_date + interval '30 days')::date, null)
ON CONFLICT (id) DO NOTHING;

-- Demo invoice_line_items
INSERT INTO invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price_amount, unit_price_currency, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Serviço de Logística - Novembro', 1, 45000.00, 'BRL', 0),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Locação de Frota - Dezembro', 1, 10000.00, 'BRL', 0),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Taxa de Gestão', 1, 2500.00, 'BRL', 1),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Assinatura Trimestral', 1, 8900.00, 'BRL', 0),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Serviços Avulsos', 2, 1600.00, 'BRL', 0)
ON CONFLICT (id) DO NOTHING;

-- More demo resources
INSERT INTO resources (id, tenant_id, branch_id, type, name, status) VALUES
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'human', 'Carlos Ajudante', 'offline'),
  ('60000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'equipment', 'Pallet Jack #01', 'available'),
  ('60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'vehicle', 'Rota SP-Sul', 'busy'),
  ('60000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'virtual', 'Sistema Rastreamento', 'available')
ON CONFLICT (id) DO NOTHING;

-- Demo user_profiles
INSERT INTO user_profiles (id, tenant_id, auth_user_id, email, full_name, status) VALUES
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'e0da37c1-cfcc-42f0-9c48-443669b305c9', 'admin@shina.com.br', 'Admin Shinã', 'active'),
  ('e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'joao.motorista@acme.com.br', 'João Silva', 'active'),
  ('e0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'maria.ops@acme.com.br', 'Maria Operações', 'inactive')
ON CONFLICT (email) DO NOTHING;
