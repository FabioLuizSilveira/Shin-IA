-- Maintenance Auditor (Etapa 14). auditFleet() (maintenance-engine) is
-- deterministic, not an LLM -- this table just persists what it finds,
-- same dedupe-by-key + human-decision shape as
-- 20260901000000_maintenance_recommendations.sql: a re-run of the audit
-- never spawns a duplicate of a condition already surfaced, and a human
-- decision (acknowledge/dismiss) is never silently overwritten.
create type maintenance_insight_type as enum (
  'critical_health_asset', 'high_risk_cluster', 'low_fleet_health', 'stale_recommendations'
);

create type maintenance_insight_severity as enum ('medium', 'high');

create type maintenance_insight_status as enum ('open', 'acknowledged', 'dismissed');

create table maintenance_insights (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  -- null for a fleet-level insight (high_risk_cluster, low_fleet_health,
  -- stale_recommendations); set for an asset-specific one
  -- (critical_health_asset).
  asset_id uuid references assets (id) on delete cascade,

  type maintenance_insight_type not null,
  severity maintenance_insight_severity not null,
  message text not null,
  insight_key text not null,

  status maintenance_insight_status not null default 'open',
  acknowledged_by uuid,
  acknowledged_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index maintenance_insights_dedupe_idx
  on maintenance_insights (tenant_id, insight_key);
create index maintenance_insights_tenant_status_idx
  on maintenance_insights (tenant_id, status);

alter table maintenance_insights enable row level security;
alter table maintenance_insights force row level security;
create policy maintenance_insights_select_tenant on maintenance_insights
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- IAM: reuses tenant.maintenance.ai_use (run the audit, same "AI de
-- manutenção" capability as recommendations/predictive-risk/copilot) and
-- tenant.maintenance.view (list insights) -- both already seeded and
-- granted in 20260112000000_maintenance.sql, no new key needed.
