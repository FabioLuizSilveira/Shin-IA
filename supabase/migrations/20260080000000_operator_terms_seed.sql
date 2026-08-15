-- OperatorTerms (party_type = operator) — standing terms of engagement
-- between Tenant and Operator, record-keeping only (no OperationContractGate
-- dependency, per explicit product decision: operators are typically the
-- tenant's own employees or the equipment owner). Reuses the same
-- clause/template/acceptance engine as the customer side, just parameterized
-- by party_type — not a second engine.
insert into tenant_contract_templates (id, tenant_id, key, party_type, name, status) values
  ('e0000000-0000-0000-0000-000000000005', null, 'operator_terms', 'operator', 'OperatorTerms', 'active')
on conflict (id) do nothing;

insert into tenant_contract_template_clauses (template_id, clause_id, is_mandatory, condition, sort_order) values
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', true, null, 0), -- GENERAL
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000014', true, null, 1), -- OPERATOR
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000016', true, null, 2), -- SAFETY
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000023', true, null, 3), -- LIABILITY
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000024', true, null, 4), -- PRIVACY
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000025', true, null, 5), -- DATA_PROCESSING
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000015', false,
    '{"field": "operatorCertificationRequired", "op": "eq", "value": true}', 6) -- CERTIFICATION
on conflict do nothing;

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
where t.id = 'e0000000-0000-0000-0000-000000000005'
group by t.id, t.key
on conflict do nothing;

-- Map every equipment/service blueprint that can involve an operator to
-- OperatorTerms too (party_type=operator resolves independently of the
-- customer-side mapping already seeded).
insert into blueprint_contract_mappings (blueprint_id, contract_template_key, is_default) values
  ('forklift', 'operator_terms', false),
  ('munk', 'operator_terms', true),
  ('crane', 'operator_terms', true),
  ('tower-crane', 'operator_terms', true),
  ('agriculture', 'operator_terms', false),
  ('construction', 'operator_terms', false)
on conflict (blueprint_id, contract_template_key) do nothing;
