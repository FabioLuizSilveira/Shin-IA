-- Tenant activity log — M31 gap: only impersonation_sessions audited
-- platform-staff access; there was no record of what tenant staff
-- themselves do (create a contract, change an operation's status, approve
-- a commission). packages/security's AuditLogger models the right shape
-- (tenantId/actorId/eventType/resource/action/outcome) but is a plain
-- in-memory array with no persistence hook — unusable as-is across
-- serverless request boundaries, so this is a direct table + insert/query
-- helper instead of an "adapter" around that class (see plan doc).

create table if not exists tenant_activity_log (
  id          uuid          primary key default gen_random_uuid(),
  tenant_id   uuid          not null,
  actor_id    uuid          not null,
  entity_type text          not null,
  entity_id   uuid          not null,
  action      text          not null,
  metadata    jsonb         not null default '{}',
  created_at  timestamptz   not null default now(),

  constraint tenant_activity_log_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index tenant_activity_log_tenant_id_idx on tenant_activity_log (tenant_id);
create index tenant_activity_log_tenant_created_idx
  on tenant_activity_log (tenant_id, created_at desc);
create index tenant_activity_log_entity_idx
  on tenant_activity_log (entity_type, entity_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Same posture as impersonation_sessions: select-only for tenant staff,
-- writes go through the service-role admin client (requireTenantScope),
-- never through a user-authenticated insert policy.
alter table tenant_activity_log enable row level security;
alter table tenant_activity_log force row level security;

create policy "tenant_activity_log_select"
  on tenant_activity_log for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
