-- M019: Create separate 'events' schema and domain_events outbox table
-- Decision #10: domain_events lives in schema 'events', not 'public'
-- No FK to public.tenants — append-only, must not block tenant deletion
-- Realtime publication for 'events' schema must be configured separately (non-default)

-- ── Schema ────────────────────────────────────────────────────────────────────
create schema if not exists events;

-- Grant schema access so authenticated and service_role can query the table
grant usage on schema events to authenticated;
grant usage on schema events to service_role;

-- ── events.domain_events ──────────────────────────────────────────────────────
-- Implements the Transactional Outbox pattern.
-- Application writes events in the same transaction as the business row.
-- Background worker polls WHERE published_at IS NULL, dispatches, then sets published_at.

create table events.domain_events (
  id              uuid          primary key,
  event_type      text          not null,
  aggregate_id    uuid          not null,
  aggregate_type  text          not null,
  tenant_id       uuid,
  version         integer       not null default 1,
  payload         jsonb         not null,
  occurred_at     timestamptz   not null,
  published_at    timestamptz
);

-- Grant table-level access
grant select on events.domain_events to authenticated;
grant all    on events.domain_events to service_role;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table events.domain_events enable row level security;
alter table events.domain_events force row level security;

-- Authenticated users can only read events for their own tenant (or platform-level events)
create policy "domain_events_select"
  on events.domain_events for select
  to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    or tenant_id is null
  );

-- INSERT, UPDATE, DELETE denied for authenticated — all writes via service_role
