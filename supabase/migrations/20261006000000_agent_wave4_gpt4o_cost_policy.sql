-- Agent Runtime Architecture v2, Wave 4 ("Model Router") -- adds the
-- missing cost policy row for gpt-4o, the COMPLEX tier's real model
-- (apps/web/src/lib/ai/model-router.ts). Without this row,
-- estimateMaxCredits()/estimateCredits() (packages/ai-gateway/src/
-- cost-policy.ts) return null for any gpt-4o call, which a real audit of
-- gateway.ts found does NOT block the call -- it silently skips both the
-- pre-check and the debit, so an unpriced model would run for free
-- instead of failing loud. This row closes that gap before COMPLEX-tier
-- calls exist anywhere in the code.
--
-- Real gpt-4o list price as of 2026-09 (developers.openai.com/api/docs/
-- pricing), same credit_multiplier placeholder (1000) as the existing
-- gpt-4o-mini row -- not a commercial credit price (spec item 26, still
-- not decided).
insert into ai_gateway_model_cost_policy (provider, model, capability, cost_basis, credit_multiplier, status)
values (
  'openai', 'gpt-4o', 'text',
  '{"inputPerMTokUsd": 2.50, "outputPerMTokUsd": 10.00, "note": "real openai list price, not a commercial credit price"}',
  1000, 'published'
);
