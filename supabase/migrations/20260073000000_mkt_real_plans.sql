-- Replaces the placeholder "growth" mkt plan seeded in
-- 20260072000000_commercial_flow.sql with the three REAL plans
-- apps/mkt/src/app/(public)/signup/page.tsx has always offered
-- (Starter/Pro/Business), wired to the actual Stripe price IDs already
-- configured in apps/mkt's env (STRIPE_PRICE_STARTER/PRO/BUSINESS) — Fase C
-- of the Unified Commercial Flow migrates MKT's checkout to go through
-- plan_versions instead of its own hardcoded PLAN_PRICE_ENV map, so the
-- plan data here needs to match reality, not the placeholder guess from
-- the previous migration.

delete from plan_versions where plan_id = 'c2000000-0000-0000-0000-000000000003';
delete from plans where id = 'c2000000-0000-0000-0000-000000000003';

insert into plans (id, product, key, name) values
  ('c2000000-0000-0000-0000-000000000004', 'mkt', 'starter', 'Starter'),
  ('c2000000-0000-0000-0000-000000000005', 'mkt', 'pro', 'Pro'),
  ('c2000000-0000-0000-0000-000000000006', 'mkt', 'business', 'Business')
on conflict (id) do nothing;

insert into plan_versions (
  id, plan_id, version, name, price_cents, currency, billing_cycle, trial_days,
  included_features, stripe_price_id, active_from, published_at, status
) values
  ('c3000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000004', 1, 'Starter',
   14900, 'BRL', 'monthly', 0, '["campaigns", "content"]',
   'price_1TyuNhH8Y4X3mVSzH0B5hwX9', now(), now(), 'published'),
  ('c3000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000005', 1, 'Pro',
   39900, 'BRL', 'monthly', 0, '["campaigns", "content", "automations"]',
   'price_1TyuNhH8Y4X3mVSzwqHvTLhe', now(), now(), 'published'),
  ('c3000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000006', 1, 'Business',
   99900, 'BRL', 'monthly', 0, '["campaigns", "content", "automations", "priority_support"]',
   'price_1TyuNiH8Y4X3mVSzgDJLHMpF', now(), now(), 'published')
on conflict (id) do nothing;
