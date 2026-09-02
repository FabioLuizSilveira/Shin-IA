-- Stripe -> Asaas migration, Fase D: rename every stripe-named billing
-- column to a gateway-neutral name. Fases A-C deliberately reused these
-- columns as-is for Asaas ids (documented in each provider/route as
-- "rename deferred to Fase D") to keep those changes small and low-risk;
-- this migration is that deferred rename, now that both gateways' code
-- paths are live-verified. Pure renames -- no data movement, no behavior
-- change. All consuming code updated in the same commit (pnpm typecheck
-- is the real safety net here: a forgotten reference fails to compile).

alter table platform_customers rename column stripe_customer_id to gateway_customer_id;
alter index platform_customers_stripe_unique rename to platform_customers_gateway_unique;

alter table platform_subscriptions rename column stripe_subscription_id to gateway_subscription_id;
alter index platform_subscriptions_stripe_unique rename to platform_subscriptions_gateway_unique;

alter table plan_versions rename column stripe_price_id to gateway_price_id;

alter table platform_billing_events rename column stripe_event_id to gateway_event_id;
alter index platform_billing_events_stripe_event_unique rename to platform_billing_events_gateway_event_unique;

alter table billing_accounts rename column stripe_customer_id to gateway_customer_id;

alter table invoices rename column stripe_checkout_session_id to gateway_checkout_id;
alter index invoices_stripe_checkout_session_idx rename to invoices_gateway_checkout_idx;
alter table invoices rename column stripe_payment_intent_id to gateway_payment_intent_id;
