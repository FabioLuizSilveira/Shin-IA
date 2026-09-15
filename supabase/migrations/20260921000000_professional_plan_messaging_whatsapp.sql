-- Commercial decision, explicitly authorized by the user: add messaging_whatsapp
-- to the professional platform plan's included_features. Published plan_versions
-- rows are immutable (same discipline as contract_versions) — supersede v1 and
-- publish v2 with identical commercial terms, only included_features changes.
insert into plan_versions (
  plan_id, version, name, price_cents, currency, billing_cycle, trial_days,
  commitment_period_months, included_features, usage_limits, overage_rules,
  discount_rules, revenue_share, metadata, gateway_price_id,
  active_from, status, published_at
)
select
  plan_id,
  version + 1,
  name,
  price_cents,
  currency,
  billing_cycle,
  trial_days,
  commitment_period_months,
  included_features || '["messaging_whatsapp"]'::jsonb,
  usage_limits,
  overage_rules,
  discount_rules,
  revenue_share,
  metadata,
  gateway_price_id,
  now(),
  'published',
  now()
from plan_versions
where id = 'c3000000-0000-0000-0000-000000000002';

update plan_versions
set status = 'superseded', active_until = now()
where id = 'c3000000-0000-0000-0000-000000000002';

-- Point active professional platform_subscriptions at the new version, so
-- getEntitlements() reflects the new feature immediately (not a real
-- price/plan change, so the billing-acceptance flow (changePlan()) is
-- deliberately not invoked — same mechanism as the prior plan_version_id
-- backfill in 20260920000000).
update platform_subscriptions ps
set plan_version_id = pv.id
from plans p
join plan_versions pv on pv.plan_id = p.id
where ps.product = 'platform'
  and p.product = 'platform'
  and p.key = 'professional'
  and ps.plan_key = 'professional'
  and pv.status = 'published'
  and pv.plan_id = p.id
  and pv.version = (
    select max(pv2.version)
    from plan_versions pv2
    where pv2.plan_id = p.id and pv2.status = 'published'
  );
