-- Recommendations (Etapa 7, P1). The spec asks this to reuse the Rule
-- Engine -- rule-engine was confirmed deleted from this repo (not just
-- archived, see git history around commit 1622e70 / CLAUDE.md), so
-- there's nothing to reuse. Deterministic rules live directly in
-- packages/maintenance-engine (deriveRecommendations()), same house
-- pattern as everywhere else in this module -- documented deviation,
-- not a silent one.
--
-- Unlike health-score/anomalies (both stateless, computed fresh on every
-- read), a recommendation needs to survive a human decision
-- (accept/dismiss) across recomputes -- that's the whole point of
-- "human-in-the-loop". So this is the first P1 piece that needs a real
-- table: recomputing must never spawn a duplicate of a recommendation
-- the user already decided on, which is what dedupe_key + the unique
-- index below is for.
create type maintenance_recommendation_type as enum (
  'schedule_preventive', 'investigate_anomaly', 'asset_review', 'revisit_preventive_plan'
);

create type maintenance_recommendation_priority as enum ('low', 'medium', 'high');

create type maintenance_recommendation_status as enum ('pending', 'accepted', 'dismissed');

create table maintenance_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,

  type maintenance_recommendation_type not null,
  priority maintenance_recommendation_priority not null,
  message text not null,

  -- Where the recommendation came from -- an overdue plan, a specific
  -- anomaly, etc. Free-text/uuid like maintenance_orders.source_type,
  -- same rationale: the source kinds this round don't need an enum/FK,
  -- and the shape stays open for later sources without a migration.
  source_type text,
  source_id uuid,

  -- Stable per (tenant, asset, rule, source) so recomputing never
  -- creates a second row for the same underlying signal -- upserted via
  -- `on conflict (tenant_id, dedupe_key) do nothing`, which also means a
  -- past accept/dismiss decision is never silently overwritten by a
  -- later recompute.
  dedupe_key text not null,

  status maintenance_recommendation_status not null default 'pending',
  decided_by uuid,
  decided_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index maintenance_recommendations_dedupe_idx
  on maintenance_recommendations (tenant_id, dedupe_key);
create index maintenance_recommendations_tenant_asset_idx
  on maintenance_recommendations (tenant_id, asset_id);
create index maintenance_recommendations_status_idx
  on maintenance_recommendations (tenant_id, status);

alter table maintenance_recommendations enable row level security;
alter table maintenance_recommendations force row level security;
create policy maintenance_recommendations_select_tenant on maintenance_recommendations
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- IAM: reuses the ai_use key already seeded in 20260112000000_maintenance.sql
-- (Etapa 18 seeded the full key list up front) -- recommendations are
-- exactly the "AI de manutenção" capability that key was meant for, not
-- a distinct feature needing its own key.
