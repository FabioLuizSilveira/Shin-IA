-- Fix found while wiring the ingestion path (Fase D): infraction_cases.tenant_id
-- was declared not null in 20260105000000, but item 5 of the spec is explicit
-- that a case can and must exist in UNMATCHED state before any asset (and
-- therefore tenant) is identified. A not-null tenant_id would make the
-- very first insert of an unmatched case fail.
alter table infraction_cases alter column tenant_id drop not null;

-- The RLS select policy already requires tenant_id = jwt tenant_id, so a
-- null-tenant (unmatched) case is correctly invisible to every tenant
-- until match resolves it — no policy change needed, just the column
-- constraint.
