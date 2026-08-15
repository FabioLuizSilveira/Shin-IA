-- Adds `platform_contract_current` to the JWT — same function edited
-- several times already this session for platform_role/mkt_subscription_status.
-- true when the tenant has accepted a contract_versions row whose
-- effective_at is >= the most recent PUBLISHED version flagged
-- material_change = true (or when no material version has ever been
-- published, in which case there's nothing to catch up on). Used by
-- middleware.ts to force re-acceptance (item 23) without blocking data
-- export/regularization routes (item 10's exception, unchanged).
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
  latest_material_effective_at timestamptz;
  platform_contract_ok boolean;
begin
  v_user_id := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';

  select tenant_id into t_id
  from public.user_profiles
  where auth_user_id = v_user_id;

  select exists(
    select 1 from public.mfa_enrollments
    where user_id = (select id from public.user_profiles where auth_user_id = v_user_id)
      and status = 'active'
  ) into mfa_active;

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

  select r.key into p_role
  from public.platform_user_roles ur
  join public.platform_roles r on ur.role_id = r.id
  where ur.user_id = v_user_id
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
  where pc.auth_user_id = v_user_id and ps.product = 'mkt'
  order by ps.created_at desc
  limit 1;

  -- Material contract re-acceptance gate (platform product only — see
  -- middleware.ts, which is the only place this claim is consumed today).
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

  claims := claims || jsonb_build_object(
    'tenant_id', t_id,
    'tenant_role', t_role,
    'platform_role', p_role,
    'branch_ids', coalesce(b_ids, '[]'::jsonb),
    'mfa_enrolled', mfa_active,
    'platform_subscription_status', platform_sub_status,
    'mkt_subscription_status', mkt_sub_status,
    'platform_contract_current', platform_contract_ok,
    'app_metadata', coalesce(claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object(
      'tenant_id', t_id,
      'tenant_role', t_role,
      'platform_role', p_role,
      'branch_ids', coalesce(b_ids, '[]'::jsonb),
      'mfa_enrolled', mfa_active,
      'platform_subscription_status', platform_sub_status,
      'mkt_subscription_status', mkt_sub_status,
      'platform_contract_current', platform_contract_ok
    )
  );

  return jsonb_build_object('claims', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon;
