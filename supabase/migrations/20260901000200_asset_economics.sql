-- Asset Economics / TCO foundation (Etapa 16, P2). Nullable, additive,
-- entered by the tenant (never inferred/estimated by the platform) --
-- computeAssetEconomics() in maintenance-engine only reports acquisition-
-- based metrics (total cost of ownership, maintenance-as-fraction) when
-- this is actually filled in, same "never invent a baseline" discipline
-- as everywhere else in this module.
alter table assets add column acquisition_cost_cents integer;

alter table assets
  add constraint assets_acquisition_cost_non_negative
  check (acquisition_cost_cents is null or acquisition_cost_cents >= 0);
