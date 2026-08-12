-- Grants fabio@shinaia.com.br (platform owner) a complimentary, non-Stripe
-- Shinã MKT subscription so the mandatory-payment gate in apps/mkt's
-- middleware (hasLiveSubscription(claims.mkt_subscription_status)) doesn't
-- block the owner's own account from apps/mkt. He already has a
-- platform_customers row + an active 'platform' subscription (from the
-- 2026-07-31 backfill); this adds the missing 'mkt' product row on the same
-- customer. No stripe_subscription_id — this was never charged, it's an
-- owner grant, marked as such in metadata for auditability.
insert into platform_subscriptions (customer_id, tenant_id, product, plan_key, status, metadata)
select
  pc.id,
  null,
  'mkt',
  'owner_complimentary',
  'active',
  jsonb_build_object('granted_reason', 'platform_owner', 'granted_at', now())
from platform_customers pc
where pc.email = 'fabio@shinaia.com.br'
on conflict (customer_id, product) where status not in ('cancelled')
do update set status = 'active', plan_key = 'owner_complimentary';
