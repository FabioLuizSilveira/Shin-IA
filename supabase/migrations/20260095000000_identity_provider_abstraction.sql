-- Firebase Auth migration, Phase 1 — Firebase Foundation (identity only, no
-- provider cutover, no data migration). Two additive pieces, neither
-- touches custom_access_token_hook or any existing table/FK:
--
-- 1. external_identities — maps any auth provider's subject (Supabase
--    auth.users.id today, Firebase UID once Phase 2 creates demo accounts)
--    onto a single canonical shina_user_id. For every EXISTING user,
--    shina_user_id is set to their current auth.users.id — the UUID every
--    FK in the system already points at (user_profiles.auth_user_id,
--    tenant_user_roles.user_id, rental_customers.auth_user_id,
--    operators.auth_user_id, etc.) — so zero FKs change and all existing
--    authorization logic keeps working unmodified. A brand-new
--    Firebase-only signup (no legacy Supabase account) would get a fresh
--    shina_user_id with no matching auth.users row; provisioning that case
--    into the rest of the schema is explicitly out of scope for this
--    migration (see docs/architecture/FIREBASE_AUTH_MIGRATION.md).
--
-- 2. resolve_shina_authorization_context(uuid) — a new function that
--    computes the exact same claim set custom_access_token_hook computes
--    (tenant_id/tenant_role/platform_role/branch_ids/mfa_enrolled/
--    subscription statuses/platform_contract_current), as a plain callable
--    RPC instead of a GoTrue-invoked hook. This is what
--    FirebaseIdentityProvider calls server-side to build a ShinaIdentity —
--    it duplicates the hook's query logic (both read the same tables) but
--    intentionally does NOT touch or replace the hook itself, which stays
--    exclusively wired to Supabase-issued tokens. Restricted to
--    service_role: this returns authorization data, never meant to be
--    called by an authenticated end-user directly.

create table if not exists external_identities (
  id uuid primary key default gen_random_uuid(),
  shina_user_id uuid not null,
  provider text not null check (provider in ('supabase', 'firebase')),
  provider_subject text not null,
  created_at timestamptz not null default now(),
  last_authenticated_at timestamptz,
  metadata jsonb not null default '{}',
  unique (provider, provider_subject)
);

create index if not exists external_identities_shina_user_id_idx
  on external_identities (shina_user_id);

alter table external_identities enable row level security;
-- No policies: service-role only, by design (identity-linking infra, not
-- user-facing data — same posture as mkt_model_cost_policy).

insert into external_identities (shina_user_id, provider, provider_subject, created_at)
select id, 'supabase', id::text, created_at
from auth.users
on conflict (provider, provider_subject) do nothing;

create or replace function public.resolve_shina_authorization_context(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  t_id uuid;
  t_role text;
  p_role text;
  b_ids jsonb;
  mfa_active boolean;
  platform_sub_status text;
  mkt_sub_status text;
  latest_material_effective_at timestamptz;
  platform_contract_ok boolean;
begin
  select tenant_id into t_id
  from public.user_profiles
  where auth_user_id = p_user_id;

  select exists(
    select 1 from public.mfa_enrollments
    where user_id = (select id from public.user_profiles where auth_user_id = p_user_id)
      and status = 'active'
  ) into mfa_active;

  if t_id is not null then
    select r.key into t_role
    from public.tenant_user_roles ur
    join public.tenant_roles r on ur.role_id = r.id
    where ur.user_id = (select id from public.user_profiles where auth_user_id = p_user_id)
      and ur.tenant_id = t_id
      and ur.deleted_at is null
      and (ur.expires_at is null or ur.expires_at > now())
    limit 1;

    select coalesce(json_agg(branch_id), '[]'::json) into b_ids
    from public.tenant_user_roles
    where user_id = (select id from public.user_profiles where auth_user_id = p_user_id)
      and tenant_id = t_id
      and deleted_at is null
      and (expires_at is null or expires_at > now())
      and branch_id is not null;
  end if;

  select r.key into p_role
  from public.platform_user_roles ur
  join public.platform_roles r on ur.role_id = r.id
  where ur.user_id = p_user_id
    and ur.deleted_at is null
    and (ur.expires_at is null or ur.expires_at > now())
  limit 1;

  if t_id is not null then
    select status::text into platform_sub_status
    from public.platform_subscriptions
    where tenant_id = t_id and product = 'platform'
    order by created_at desc
    limit 1;
  end if;

  select ps.status::text into mkt_sub_status
  from public.platform_subscriptions ps
  join public.platform_customers pc on pc.id = ps.customer_id
  where pc.auth_user_id = p_user_id and ps.product = 'mkt'
  order by ps.created_at desc
  limit 1;

  if t_id is not null then
    select max(cv.effective_at) into latest_material_effective_at
    from public.contract_versions cv
    join public.contract_templates ct on ct.id = cv.contract_template_id
    where ct.product = 'platform' and cv.status = 'published' and cv.material_change = true;

    if latest_material_effective_at is null then
      platform_contract_ok := true;
    else
      select exists(
        select 1
        from public.contract_acceptances ca
        join public.contract_versions cv on cv.id = ca.contract_version_id
        where ca.tenant_id = t_id
          and ca.product = 'platform'
          and cv.effective_at >= latest_material_effective_at
      ) into platform_contract_ok;
    end if;
  else
    platform_contract_ok := true;
  end if;

  return jsonb_build_object(
    'tenant_id', t_id,
    'tenant_role', t_role,
    'platform_role', p_role,
    'branch_ids', coalesce(b_ids, '[]'::jsonb),
    'mfa_enrolled', mfa_active,
    'platform_subscription_status', platform_sub_status,
    'mkt_subscription_status', mkt_sub_status,
    'platform_contract_current', platform_contract_ok
  );
end;
$$;

revoke execute on function public.resolve_shina_authorization_context from authenticated, anon;
grant execute on function public.resolve_shina_authorization_context to service_role;
