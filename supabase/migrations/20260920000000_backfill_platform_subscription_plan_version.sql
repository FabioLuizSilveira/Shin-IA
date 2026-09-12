-- Data-integrity fix, found live-testing the WhatsApp Messaging Platform's
-- Wave 4 (Shinã Agent Copilot) against production: BOTH real
-- platform_subscriptions rows for product='platform' have plan_version_id
-- NULL — pre-Fase-A rows that predate plan_version_id existing at all (see
-- api/commercial/accept/route.ts's own comment about this exact case and
-- its fallback-by-plan_key lookup for reaccept flows).
--
-- getEntitlements() (packages/commercial-platform/src/entitlements.ts) joins
-- plan_versions(included_features) via plan_version_id — with it NULL, the
-- embed returns nothing and entitlements.features silently becomes [] even
-- though the subscription itself is `status = 'active'`. This blocks EVERY
-- feature-gated entitlement check for these two tenants (not just the new
-- messaging_whatsapp check that surfaced it), including the pre-existing
-- Agent Platform's own checks.
--
-- Backfills each row to the highest published plan_version for its own
-- product+plan_key (the same resolution `api/commercial/accept/route.ts`
-- already does at request time) — a one-time, narrowly-scoped, idempotent
-- backfill, not a general trigger/constraint change.
update platform_subscriptions ps
set plan_version_id = pv.id
from plans p
join plan_versions pv on pv.plan_id = p.id
where ps.product = 'platform'
  and ps.plan_version_id is null
  and p.product = 'platform'
  and p.key = ps.plan_key
  and pv.status = 'published'
  and pv.version = (
    select max(pv2.version)
    from plan_versions pv2
    where pv2.plan_id = p.id and pv2.status = 'published'
  );
