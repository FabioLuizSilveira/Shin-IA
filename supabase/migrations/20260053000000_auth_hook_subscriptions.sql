-- Subscription claims in the access token + backfill for pre-existing tenants.
--
-- Part 1 — backfill: tenants created before 20260052000000_platform_billing
-- have no platform_subscriptions row. The middleware gate reads the
-- subscription claim, so without this backfill every existing tenant would
-- be locked out the moment the gate ships. Customer = the tenant's oldest
-- user_profile (its original admin).

insert into platform_customers (auth_user_id, email)
select distinct on (up.tenant_id) up.auth_user_id, up.email
from user_profiles up
join tenants t on t.id = up.tenant_id and t.deleted_at is null
where up.deleted_at is null
  and not exists (
    select 1 from platform_subscriptions ps
    where ps.tenant_id = up.tenant_id and ps.product = 'platform'
  )
order by up.tenant_id, up.created_at asc
on conflict (auth_user_id) do nothing;

insert into platform_subscriptions (customer_id, tenant_id, product, plan_key, status)
select
  pc.id,
  t.id,
  'platform',
  t.plan::text,
  (case t.status::text
    when 'trialing'  then 'trialing'
    when 'active'    then 'active'
    when 'suspended' then 'suspended'
    else 'cancelled'
  end)::platform_subscription_status
from tenants t
join lateral (
  select up.auth_user_id
  from user_profiles up
  where up.tenant_id = t.id and up.deleted_at is null
  order by up.created_at asc
  limit 1
) first_admin on true
join platform_customers pc on pc.auth_user_id = first_admin.auth_user_id
where t.deleted_at is null
  and not exists (
    select 1 from platform_subscriptions ps
    where ps.tenant_id = t.id and ps.product = 'platform'
  );

-- Part 2 — hook extension: same function as 20260047000000_auth_hook.sql,
-- with two additive claims resolved by an unconditional lookup that runs
-- regardless of the tenant/platform branch:
--   platform_subscription_status — via tenant_id (null for staff/mkt-only)
--   mkt_subscription_status      — via platform_customers.auth_user_id
--                                  (null for anyone who never bought MKT)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  claims jsonb;
  v_user_id uuid;
  t_id uuid;
  t_role text;
  p_role text;
  b_ids jsonb;
  mfa_active boolean;
  platform_sub_status text;
  mkt_sub_status text;
begin
  -- Get user ID and current claims from event payload
  v_user_id := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';

  -- 1. Get tenant_id from user_profiles
  select tenant_id into t_id
  from public.user_profiles
  where auth_user_id = v_user_id;

  -- 2. Get MFA enrollment status (verified/active status)
  select exists(
    select 1 from public.mfa_enrollments
    where user_id = (select id from public.user_profiles where auth_user_id = v_user_id)
      and status = 'active'
  ) into mfa_active;

  -- 3. Get roles and branches
  if t_id is not null then
    -- Tenant role key
    select r.key into t_role
    from public.tenant_user_roles ur
    join public.tenant_roles r on ur.role_id = r.id
    where ur.user_id = (select id from public.user_profiles where auth_user_id = v_user_id)
      and ur.tenant_id = t_id
      and ur.deleted_at is null
      and (ur.expires_at is null or ur.expires_at > now())
    limit 1;

    -- Branch IDs
    select coalesce(json_agg(branch_id), '[]'::json) into b_ids
    from public.tenant_user_roles
    where user_id = (select id from public.user_profiles where auth_user_id = v_user_id)
      and tenant_id = t_id
      and deleted_at is null
      and (expires_at is null or expires_at > now())
      and branch_id is not null;
  else
    -- Platform role key
    select r.key into p_role
    from public.platform_user_roles ur
    join public.platform_roles r on ur.role_id = r.id
    where ur.user_id = v_user_id
      and ur.deleted_at is null
      and (ur.expires_at is null or ur.expires_at > now())
    limit 1;
  end if;

  -- 4. Subscription statuses (independent of the tenant/platform branch)
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
  where pc.auth_user_id = v_user_id and ps.product = 'mkt'
  order by ps.created_at desc
  limit 1;

  -- Enrich claims object at root level and within app_metadata
  claims := claims || jsonb_build_object(
    'tenant_id', t_id,
    'tenant_role', t_role,
    'platform_role', p_role,
    'branch_ids', coalesce(b_ids, '[]'::jsonb),
    'mfa_enrolled', mfa_active,
    'platform_subscription_status', platform_sub_status,
    'mkt_subscription_status', mkt_sub_status,
    'app_metadata', coalesce(claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object(
      'tenant_id', t_id,
      'tenant_role', t_role,
      'platform_role', p_role,
      'branch_ids', coalesce(b_ids, '[]'::jsonb),
      'mfa_enrolled', mfa_active,
      'platform_subscription_status', platform_sub_status,
      'mkt_subscription_status', mkt_sub_status
    )
  );

  return jsonb_build_object('claims', claims);
end;
$$;
