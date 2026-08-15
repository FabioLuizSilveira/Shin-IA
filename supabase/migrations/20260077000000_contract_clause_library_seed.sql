-- Clause Library + 4 base contract templates (global, tenant_id null).
-- Placeholder legal text — Shinã's legal team reviews before production,
-- same caveat already used for commercial_flow.sql's seed.

-- ── Clause library (one clause per category used by the 4 base templates) ──
insert into tenant_contract_clauses (id, tenant_id, category, key, title, content, version, status) values
  ('d0000000-0000-0000-0000-000000000001', null, 'general', 'GENERAL_STANDARD', 'Disposições Gerais',
   '[PLACEHOLDER] Disposições gerais aplicáveis a esta contratação.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000002', null, 'payment', 'PAYMENT_STANDARD', 'Pagamento',
   '[PLACEHOLDER] Condições de pagamento, valores e forma de cobrança.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000003', null, 'cancellation', 'CANCELLATION_STANDARD', 'Cancelamento',
   '[PLACEHOLDER] Condições de cancelamento e eventuais penalidades.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000004', null, 'delivery', 'DELIVERY_STANDARD', 'Entrega',
   '[PLACEHOLDER] Condições de entrega do ativo.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000005', null, 'return', 'RETURN_STANDARD', 'Devolução',
   '[PLACEHOLDER] Condições de devolução do ativo.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000006', null, 'damage', 'DAMAGE_STANDARD', 'Avarias',
   '[PLACEHOLDER] Responsabilidade por avarias identificadas na entrega e devolução.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000007', null, 'insurance', 'INSURANCE_STANDARD', 'Seguro/Proteção',
   '[PLACEHOLDER] Cobertura de seguro/proteção contratada: {{insurance_type}}.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000008', null, 'tracking', 'TRACKING_STANDARD', 'Rastreamento',
   '[PLACEHOLDER] Este ativo é monitorado por rastreamento durante o período de utilização.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000009', null, 'telemetry', 'TELEMETRY_STANDARD', 'Telemetria',
   '[PLACEHOLDER] Dados de telemetria coletados durante a operação.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000010', null, 'fuel', 'FUEL_STANDARD', 'Combustível',
   '[PLACEHOLDER] Política de combustível aplicável a esta locação.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000011', null, 'mileage', 'MILEAGE_STANDARD', 'Quilometragem',
   '[PLACEHOLDER] Franquia e política de quilometragem excedente.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000012', null, 'hour_meter', 'HOUR_METER_STANDARD', 'Horímetro',
   '[PLACEHOLDER] Controle e franquia de horas de uso do equipamento.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000013', null, 'fines', 'FINES_STANDARD', 'Multas',
   '[PLACEHOLDER] Responsabilidade pelo pagamento de multas de trânsito durante o período.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000014', null, 'operator', 'OPERATOR_STANDARD', 'Operador',
   '[PLACEHOLDER] Condições relativas ao operador designado para esta operação.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000015', null, 'certification', 'CERTIFICATION_STANDARD', 'Certificação',
   '[PLACEHOLDER] Exigência de certificação/habilitação do operador designado.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000016', null, 'safety', 'SAFETY_STANDARD', 'Segurança',
   '[PLACEHOLDER] Normas de segurança aplicáveis à execução desta operação.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000017', null, 'maintenance', 'MAINTENANCE_STANDARD', 'Manutenção',
   '[PLACEHOLDER] Responsabilidade por manutenção preventiva e corretiva durante o período.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000018', null, 'security_deposit', 'SECURITY_DEPOSIT_STANDARD', 'Caução',
   '[PLACEHOLDER] Caução de {{security_deposit_amount}} exigida como garantia.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000019', null, 'transport', 'TRANSPORT_STANDARD', 'Transporte',
   '[PLACEHOLDER] Condições de transporte do ativo até/desde o local de utilização.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000020', null, 'mobilization', 'MOBILIZATION_STANDARD', 'Mobilização',
   '[PLACEHOLDER] Condições de mobilização do ativo/equipe até o local da operação.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000021', null, 'demobilization', 'DEMOBILIZATION_STANDARD', 'Desmobilização',
   '[PLACEHOLDER] Condições de desmobilização ao término da operação.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000022', null, 'overtime', 'OVERTIME_STANDARD', 'Horas Excedentes',
   '[PLACEHOLDER] Cobrança de horas excedentes além da jornada contratada.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000023', null, 'liability', 'LIABILITY_STANDARD', 'Responsabilidade',
   '[PLACEHOLDER] Limites de responsabilidade entre as partes.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000024', null, 'privacy', 'PRIVACY_STANDARD', 'Privacidade',
   '[PLACEHOLDER] Aviso de privacidade aplicável a esta contratação.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000025', null, 'data_processing', 'DATA_PROCESSING_STANDARD', 'Tratamento de Dados',
   '[PLACEHOLDER] Finalidade e base jurídica do tratamento de dados pessoais nesta operação.', 1, 'published'),
  ('d0000000-0000-0000-0000-000000000026', null, 'consumer_rights', 'CONSUMER_RIGHTS_STANDARD', 'Direitos do Consumidor',
   '[PLACEHOLDER] Direitos assegurados ao consumidor nos termos da legislação aplicável.', 1, 'published')
on conflict (id) do nothing;

-- ── Templates (global, party_type = customer) ───────────────────────────────
insert into tenant_contract_templates (id, tenant_id, key, party_type, name, status) values
  ('e0000000-0000-0000-0000-000000000001', null, 'vehicle_rental', 'customer', 'VehicleRentalAgreement', 'active'),
  ('e0000000-0000-0000-0000-000000000002', null, 'equipment_rental', 'customer', 'EquipmentRentalAgreement', 'active'),
  ('e0000000-0000-0000-0000-000000000003', null, 'equipment_with_operator', 'customer', 'EquipmentWithOperatorAgreement', 'active'),
  ('e0000000-0000-0000-0000-000000000004', null, 'service_provision', 'customer', 'ServiceProvisionAgreement', 'active')
on conflict (id) do nothing;

-- ── VehicleRentalAgreement clauses ──────────────────────────────────────────
insert into tenant_contract_template_clauses (template_id, clause_id, is_mandatory, condition, sort_order) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', true, null, 0), -- GENERAL
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', true, null, 1), -- PAYMENT
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', true, null, 2), -- DELIVERY
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', true, null, 3), -- RETURN
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', true, null, 4), -- DAMAGE
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000011', true, null, 5), -- MILEAGE
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000013', true, null, 6), -- FINES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000024', true, null, 7), -- PRIVACY
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000025', true, null, 8), -- DATA_PROCESSING
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000026', true, null, 9), -- CONSUMER_RIGHTS
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000007', false,
    '{"field": "insuranceIncluded", "op": "eq", "value": true}', 10), -- INSURANCE
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000008', false,
    '{"field": "trackingEnabled", "op": "eq", "value": true}', 11), -- TRACKING
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000018', false,
    '{"field": "securityDeposit", "op": "gt", "value": 0}', 12); -- SECURITY_DEPOSIT

-- ── EquipmentRentalAgreement clauses ────────────────────────────────────────
insert into tenant_contract_template_clauses (template_id, clause_id, is_mandatory, condition, sort_order) values
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', true, null, 0), -- GENERAL
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', true, null, 1), -- PAYMENT
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', true, null, 2), -- DELIVERY
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', true, null, 3), -- RETURN
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000012', true, null, 4), -- HOUR_METER
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000017', true, null, 5), -- MAINTENANCE
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000006', true, null, 6), -- DAMAGE
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000024', true, null, 7), -- PRIVACY
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000025', true, null, 8), -- DATA_PROCESSING
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000026', true, null, 9), -- CONSUMER_RIGHTS
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000019', false,
    '{"field": "transportIncluded", "op": "eq", "value": true}', 10), -- TRANSPORT
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000010', false,
    '{"field": "fuelPolicyApplies", "op": "eq", "value": true}', 11), -- FUEL
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', false,
    '{"field": "insuranceIncluded", "op": "eq", "value": true}', 12), -- INSURANCE
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000018', false,
    '{"field": "securityDeposit", "op": "gt", "value": 0}', 13); -- SECURITY_DEPOSIT

-- ── EquipmentWithOperatorAgreement clauses ──────────────────────────────────
insert into tenant_contract_template_clauses (template_id, clause_id, is_mandatory, condition, sort_order) values
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', true, null, 0), -- GENERAL
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', true, null, 1), -- PAYMENT
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000014', true, null, 2), -- OPERATOR
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000016', true, null, 3), -- SAFETY
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000020', true, null, 4), -- MOBILIZATION
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000021', true, null, 5), -- DEMOBILIZATION
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000023', true, null, 6), -- LIABILITY
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000024', true, null, 7), -- PRIVACY
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000025', true, null, 8), -- DATA_PROCESSING
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000026', true, null, 9), -- CONSUMER_RIGHTS
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000015', false,
    '{"field": "operatorCertificationRequired", "op": "eq", "value": true}', 10), -- CERTIFICATION
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000022', false,
    '{"field": "overtimeApplies", "op": "eq", "value": true}', 11), -- OVERTIME
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000010', false,
    '{"field": "fuelPolicyApplies", "op": "eq", "value": true}', 12); -- FUEL

-- ── ServiceProvisionAgreement clauses ───────────────────────────────────────
insert into tenant_contract_template_clauses (template_id, clause_id, is_mandatory, condition, sort_order) values
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', true, null, 0), -- GENERAL
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', true, null, 1), -- PAYMENT
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', true, null, 2), -- CANCELLATION
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000023', true, null, 3), -- LIABILITY
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000024', true, null, 4), -- PRIVACY
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000025', true, null, 5), -- DATA_PROCESSING
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000026', true, null, 6), -- CONSUMER_RIGHTS
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000016', false,
    '{"field": "assetCategory", "op": "in", "value": ["crane", "munk"]}', 7), -- SAFETY
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000015', false,
    '{"field": "operatorCertificationRequired", "op": "eq", "value": true}', 8); -- CERTIFICATION

-- ── Published v1 for each template — resolved_clauses is an audit copy of
-- the clause set at publish time (mandatory + conditional definitions),
-- not a per-instance render (that happens at contract-generation time,
-- Fase E, against the live template_clauses of the currently-published
-- version's template). ─────────────────────────────────────────────────────
insert into tenant_contract_versions (id, template_id, version, resolved_clauses, content_hash, effective_at, status)
select
  gen_random_uuid(),
  t.id,
  1,
  coalesce(jsonb_agg(jsonb_build_object(
    'clause_key', c.key, 'category', c.category, 'is_mandatory', tc.is_mandatory, 'condition', tc.condition
  ) order by tc.sort_order), '[]'::jsonb),
  encode(sha256(t.key::bytea), 'hex'),
  now(),
  'published'
from tenant_contract_templates t
join tenant_contract_template_clauses tc on tc.template_id = t.id
join tenant_contract_clauses c on c.id = tc.clause_id
where t.id in (
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000004'
)
group by t.id, t.key
on conflict do nothing;
