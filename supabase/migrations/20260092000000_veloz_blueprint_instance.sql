-- Veloz Rent a Car (demo tenant) never got a blueprint_instances row despite
-- being a pure vehicle-rental fleet — apps/web's sidebar now hides
-- Recursos/Operadores for any tenant whose only installed blueprints are
-- vehicle-rental ones (mobility/rental-cars/rental-motorcycles, see
-- packages/blueprint-runtime/src/built-ins.ts), and that rule needs a real
-- row to key off for Veloz specifically.
insert into blueprint_instances (tenant_id, blueprint_id, blueprint_version, status, installed_by)
select '10000000-0000-0000-0000-000000000001', 'rental-cars', '1.0.0', 'active',
       'e0000000-0000-0000-0000-000000000001'
where not exists (
  select 1 from blueprint_instances
  where tenant_id = '10000000-0000-0000-0000-000000000001' and blueprint_id = 'rental-cars'
);
