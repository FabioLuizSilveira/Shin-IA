-- Bucket privado de mídia de vistoria + templates globais iniciais +
-- mapeamento blueprint→template pros 10 blueprints built-in reais
-- (packages/blueprint-runtime/src/built-ins.ts). Ver docs/architecture/
-- INSPECTION_ENGINE.md §6/§4 para a justificativa de cada decisão.

-- ── Storage ──────────────────────────────────────────────────────────────
-- Privado, ao contrário de asset-photos (público) — fotos de vistoria
-- nunca são públicas por padrão (item 20 do spec). Limite generoso (15
-- MiB) porque inclui vídeo curto além de foto/documento.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspection-media',
  'inspection-media',
  false,
  15728640, -- 15 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf']
)
on conflict (id) do nothing;

-- ── Template global: vehicle_standard_v1 ────────────────────────────────
-- Cobre o exemplo de veículo do item 4 do spec (identificação, exterior,
-- interior, mecânica/operacional). tenant_id null = global, qualquer
-- tenant pode usar direto ou clonar pra customizar.

insert into inspection_templates (id, tenant_id, key, name, status, version)
values (
  'a0000000-0000-0000-0000-000000000001', null, 'vehicle_standard_v1',
  'Vistoria Padrão — Veículos', 'published', 1
);

insert into inspection_template_sections (id, template_id, tenant_id, key, title, sort_order)
values
  ('a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', null, 'identification', 'Identificação', 1),
  ('a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'exterior', 'Exterior', 2),
  ('a0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', null, 'interior', 'Interior', 3),
  ('a0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000001', null, 'mechanical', 'Mecânica / Operacional', 4);

insert into inspection_template_items
  (id, section_id, template_id, tenant_id, key, label, field_type, required, sort_order, min_photos, max_photos)
values
  -- Identificação
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', null, 'plate', 'Placa', 'text', true, 1, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', null, 'vin', 'VIN / Chassi', 'text', false, 2, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', null, 'odometer', 'Quilometragem', 'odometer', true, 3, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', null, 'fuel_level', 'Combustível', 'percentage', true, 4, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', null, 'battery', 'Bateria', 'condition', false, 5, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', null, 'documentation', 'Documentação no veículo', 'boolean', false, 6, null, null),
  -- Exterior (cada ângulo exige pelo menos 1 foto — captura guiada, item 6 do spec)
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'front', 'Dianteira', 'photo', true, 1, 1, 3),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'rear', 'Traseira', 'photo', true, 2, 1, 3),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'left_side', 'Lateral Esquerda', 'photo', true, 3, 1, 3),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'right_side', 'Lateral Direita', 'photo', true, 4, 1, 3),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'roof', 'Teto', 'photo', false, 5, 1, 2),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'wheels', 'Rodas', 'photo', true, 6, 1, 4),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'tires', 'Pneus', 'condition', true, 7, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'glass', 'Vidros', 'condition', false, 8, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', null, 'headlights', 'Faróis', 'condition', false, 9, null, null),
  -- Interior
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', null, 'dashboard', 'Painel', 'photo', false, 1, 1, 2),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', null, 'seats', 'Bancos', 'condition', false, 2, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', null, 'console', 'Console', 'condition', false, 3, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', null, 'trunk', 'Porta-malas', 'photo', false, 4, 1, 2),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', null, 'accessories', 'Acessórios', 'textarea', false, 5, null, null),
  -- Mecânica/operacional
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000001', null, 'dashboard_alerts', 'Alertas no painel', 'boolean', true, 1, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000001', null, 'operating_condition', 'Funcionamento geral', 'condition', true, 2, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000001', null, 'observations', 'Observações', 'textarea', false, 3, null, null);

-- ── Template global: equipment_standard_v1 ──────────────────────────────
-- Cobre o exemplo de empilhadeira do item 4 do spec — reaproveitável por
-- qualquer equipamento industrial/construção/agrícola sem herdar campos
-- de veículo que não fazem sentido pra eles (item 1 do objetivo: o
-- sistema não pode ser limitado a automóveis).

insert into inspection_templates (id, tenant_id, key, name, status, version)
values (
  'a0000000-0000-0000-0000-000000000002', null, 'equipment_standard_v1',
  'Vistoria Padrão — Equipamentos', 'published', 1
);

insert into inspection_template_sections (id, template_id, tenant_id, key, title, sort_order)
values
  ('a0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000002', null, 'identification', 'Identificação', 1),
  ('a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000002', null, 'operational', 'Operacional', 2),
  ('a0000000-0000-0000-0000-000000000203', 'a0000000-0000-0000-0000-000000000002', null, 'safety', 'Segurança', 3);

insert into inspection_template_items
  (id, section_id, template_id, tenant_id, key, label, field_type, required, sort_order, min_photos, max_photos)
values
  -- Identificação
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000002', null, 'serial_number', 'Número de série', 'text', true, 1, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000002', null, 'hour_meter', 'Horímetro', 'hour_meter', true, 2, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000002', null, 'overview_photo', 'Foto geral do equipamento', 'photo', true, 3, 1, 4),
  -- Operacional
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000002', null, 'forks_or_attachment', 'Garfos / Implemento', 'condition', false, 1, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000002', null, 'mast_or_boom', 'Torre / Lança', 'condition', false, 2, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000002', null, 'tires_or_tracks', 'Pneus / Esteiras', 'condition', true, 3, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000002', null, 'hydraulic_system', 'Sistema hidráulico', 'condition', false, 4, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000002', null, 'power_source', 'Bateria / Combustível', 'percentage', true, 5, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000002', null, 'controls', 'Comandos', 'condition', true, 6, null, null),
  -- Segurança — item de gate (item 4 do spec: aprovação/reprovação)
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000203', 'a0000000-0000-0000-0000-000000000002', null, 'safety_devices', 'Dispositivos de segurança', 'boolean', true, 1, null, null),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000203', 'a0000000-0000-0000-0000-000000000002', null, 'observations', 'Observações', 'textarea', false, 2, null, null);

update inspection_template_items
  set approval_gate = true
  where section_id = 'a0000000-0000-0000-0000-000000000203' and key = 'safety_devices';

-- ── Mapeamento blueprint → template ──────────────────────────────────────
-- Mesmos 10 blueprints reais de blueprint_contract_mappings
-- (20260078000000). Veículos usam vehicle_standard_v1; o resto usa
-- equipment_standard_v1 — o mesmo template serve check_in e check_out
-- (checklist idêntico nos dois pontos é o que permite a comparação
-- item-a-item do item 8 do spec).

insert into blueprint_inspection_mappings (blueprint_id, purpose, template_id, is_default, required)
select v.blueprint_id, v.purpose::inspection_purpose, v.template_id::uuid, true, true
from (
  values
    ('mobility', 'check_in', 'a0000000-0000-0000-0000-000000000001'),
    ('mobility', 'check_out', 'a0000000-0000-0000-0000-000000000001'),
    ('rental-cars', 'check_in', 'a0000000-0000-0000-0000-000000000001'),
    ('rental-cars', 'check_out', 'a0000000-0000-0000-0000-000000000001'),
    ('rental-motorcycles', 'check_in', 'a0000000-0000-0000-0000-000000000001'),
    ('rental-motorcycles', 'check_out', 'a0000000-0000-0000-0000-000000000001'),
    ('forklift', 'check_in', 'a0000000-0000-0000-0000-000000000002'),
    ('forklift', 'check_out', 'a0000000-0000-0000-0000-000000000002'),
    ('munk', 'check_in', 'a0000000-0000-0000-0000-000000000002'),
    ('munk', 'check_out', 'a0000000-0000-0000-0000-000000000002'),
    ('crane', 'check_in', 'a0000000-0000-0000-0000-000000000002'),
    ('crane', 'check_out', 'a0000000-0000-0000-0000-000000000002'),
    ('tower-crane', 'check_in', 'a0000000-0000-0000-0000-000000000002'),
    ('tower-crane', 'check_out', 'a0000000-0000-0000-0000-000000000002'),
    ('agriculture', 'check_in', 'a0000000-0000-0000-0000-000000000002'),
    ('agriculture', 'check_out', 'a0000000-0000-0000-0000-000000000002'),
    ('construction', 'check_in', 'a0000000-0000-0000-0000-000000000002'),
    ('construction', 'check_out', 'a0000000-0000-0000-0000-000000000002'),
    ('generic-assets', 'check_in', 'a0000000-0000-0000-0000-000000000002'),
    ('generic-assets', 'check_out', 'a0000000-0000-0000-0000-000000000002')
) as v (blueprint_id, purpose, template_id)
where not exists (
  select 1 from blueprint_inspection_mappings m
  where m.blueprint_id = v.blueprint_id and m.purpose = v.purpose::inspection_purpose
);
