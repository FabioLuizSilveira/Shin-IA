-- Document requirements for the seeded templates — closes the gap where
-- blueprint customFields already declared requires_cnh_category_b /
-- requires_cnh_category_a / requires_certified_operator (built-ins.ts) with
-- nothing consuming them.
insert into contract_document_requirements (template_id, key, label, is_mandatory) values
  ('e0000000-0000-0000-0000-000000000001', 'cnh_category_b', 'CNH categoria B', true),
  ('e0000000-0000-0000-0000-000000000003', 'operator_certification', 'Certificação do operador', true)
on conflict (template_id, key) do nothing;
