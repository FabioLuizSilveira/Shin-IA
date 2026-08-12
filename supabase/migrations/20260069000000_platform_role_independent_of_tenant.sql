-- custom_access_token_hook previously resolved platform_role only in the
-- `else` branch of the tenant_id check (see 20260053000000_auth_hook_subscriptions.sql,
-- the current definition being replaced here) — meaning a user who is BOTH
-- a real tenant member (has a user_profiles row with tenant_id) AND holds a
-- platform_user_roles entry (e.g. fabio@shinaia.com.br: tenant_admin on the
-- demo tenant + platform_owner) never got their platform_role claim
-- resolved at all, since t_id was never null for them. Fixed by resolving
-- platform_role unconditionally, independent of tenant_id — a user can now
-- carry both claims simultaneously. All other claims (subscription statuses,
-- branch_ids, mfa) are untouched, just carried over from the prior version.
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

  -- 3. Tenant role and branches (only when the user has a tenant profile)
  if t_id is not null then
    select r.key into t_role
    from public.tenant_user_roles ur
    join public.tenant_roles r on ur.role_id = r.id
    where ur.user_id = (select id from public.user_profiles where auth_user_id = v_user_id)
      and ur.tenant_id = t_id
      and ur.deleted_at is null
      and (ur.expires_at is null or ur.expires_at > now())
    limit 1;

    select coalesce(json_agg(branch_id), '[]'::json) into b_ids
    from public.tenant_user_roles
    where user_id = (select id from public.user_profiles where auth_user_id = v_user_id)
      and tenant_id = t_id
      and deleted_at is null
      and (expires_at is null or expires_at > now())
      and branch_id is not null;
  end if;

  -- 4. Platform role — resolved unconditionally, independent of tenant_id,
  -- so a user can hold both a tenant role and a platform role at once.
  select r.key into p_role
  from public.platform_user_roles ur
  join public.platform_roles r on ur.role_id = r.id
  where ur.user_id = v_user_id
    and ur.deleted_at is null
    and (ur.expires_at is null or ur.expires_at > now())
  limit 1;

  -- 5. Subscription statuses (independent of the tenant/platform branch)
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

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon;
