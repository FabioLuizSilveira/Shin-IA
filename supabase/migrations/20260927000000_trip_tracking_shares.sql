-- WAVE 5 — Multi-Operation Business Architecture v2: secure customer trip
-- tracking links (spec section 27: "tenant-scoped, resource-scoped,
-- expirável, revogável, sem expor outros dados"). Mirrors
-- inspection_report_shares (20260102000000) exactly — same token-hash
-- (never plaintext), expiry, revocation, access-count discipline — rather
-- than inventing a new sharing primitive for one more resource type.

create table if not exists trip_tracking_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  operation_id uuid not null references operations (id) on delete cascade,
  token_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer not null default 0
);
create unique index if not exists trip_tracking_shares_token_hash_idx
  on trip_tracking_shares (token_hash);
create index if not exists trip_tracking_shares_operation_id_idx
  on trip_tracking_shares (operation_id);
create index if not exists trip_tracking_shares_tenant_id_idx
  on trip_tracking_shares (tenant_id);
comment on column trip_tracking_shares.token_hash is
  'SHA-256 do token real — o token em claro nunca é persistido, mesmo '
  'princípio de inspection_report_shares.token_hash.';

alter table trip_tracking_shares enable row level security;
alter table trip_tracking_shares force row level security;
create policy "trip_tracking_shares_select_tenant" on trip_tracking_shares
  for select to authenticated using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Same IAM pattern as tenant.inspections.share (20260102000000) — narrow,
-- separate from any general trip-view permission.
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (
  values
    ('tenant.trips.share', 'trips', 'share', 'Compartilhar link de acompanhamento de viagem')
) as v (key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key = 'tenant.trips.share'
  and not exists (
    select 1 from tenant_role_permissions
    where role_id = tr.id and permission_id = tp.id
  );
