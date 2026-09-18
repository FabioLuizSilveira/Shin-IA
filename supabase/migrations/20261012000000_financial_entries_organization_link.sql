-- Optional link from a financial_entries row to a customer/supplier
-- organization -- lets a manual revenue/expense entry be tied to "who"
-- it's about (e.g. a cash sale for a specific customer, a supplier
-- expense), needed for the "filtrar por cliente" requirement. Nullable:
-- most entries (rent, salaries) have no real organization to link.

alter table financial_entries
  add column if not exists organization_id uuid references organizations (id) on delete set null;

create index if not exists financial_entries_organization_id_idx
  on financial_entries (organization_id) where organization_id is not null;
