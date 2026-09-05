-- The Shinã Agent Platform now runs exclusively on OpenAI (product
-- decision 2026-09-05: apps/web only ever configures OPENAI_API_KEY, never
-- ANTHROPIC_API_KEY, so its "messages" tool-calling path -- see
-- packages/ai-gateway/src/gateway.ts's header comment -- always uses
-- OpenAI). apps/mkt's own prompt/vision path is untouched, still Anthropic.
--
-- Real gpt-4o-mini list price as of 2026-09 (developers.openai.com/api/docs/
-- pricing), NOT a commercial credit price -- same credit_multiplier (1000,
-- ~1 credit ≈ $0.001) placeholder as the existing anthropic row, pending
-- the actual commercial decision (spec item 26, not decided here).
insert into ai_gateway_model_cost_policy (provider, model, capability, cost_basis, credit_multiplier, status)
values (
  'openai', 'gpt-4o-mini', 'text',
  '{"inputPerMTokUsd": 0.15, "outputPerMTokUsd": 0.60, "note": "real openai list price, not a commercial credit price"}',
  1000, 'published'
);
