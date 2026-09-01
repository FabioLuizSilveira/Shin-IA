-- Inspection -> Maintenance integration (Etapa 9, P1... reclassified here
-- as the natural next step after P2, see docs/modules/MAINTENANCE.md).
-- "Preserving source references": maintenance_orders already carries
-- source_type/source_id (P0) pointing at the finding; this adds the
-- reverse pointer on the finding itself, which also doubles as the
-- idempotency check (a finding can only ever produce one maintenance
-- order -- the route checks this column before inserting).
alter table inspection_findings
  add column maintenance_order_id uuid references maintenance_orders (id) on delete set null;

create index inspection_findings_maintenance_order_id_idx
  on inspection_findings (maintenance_order_id) where maintenance_order_id is not null;
