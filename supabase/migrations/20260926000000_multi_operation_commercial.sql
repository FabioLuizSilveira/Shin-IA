-- WAVE 4 — Multi-Operation Business Architecture v2: Commercial.
--
-- Additive only: commercial_configurations gains operation_configurations
-- (spec section 31's TenantCommercialConfiguration.operationConfigurations),
-- a per-operation line-item list ([{operationType, assetQuantity}]) kept
-- alongside the existing plan/extensions/quotas — this prompt deliberately
-- does not define per-operation PRICING rules (section 31: "Não definir
-- neste prompt como cada operação será cobrada"), so this is descriptive
-- data for the contract annex and provisioning, not a pricing engine.
alter table commercial_configurations
  add column if not exists operation_configurations jsonb not null default '[]'::jsonb;
