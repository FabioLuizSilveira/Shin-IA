-- Create Postgres function to act as Custom Access Token Hook
-- This function replaces the broken/unreachable Edge Function hook and resolves claims directly in database
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  claims jsonb;
  user_id uuid;
  t_id uuid;
  t_role text;
  p_role text;
  b_ids jsonb;
  mfa_active boolean;
begin
  -- Get user ID and current claims from event payload
  user_id := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';

  -- 1. Get tenant_id from user_profiles
  select tenant_id into t_id
  from public.user_profiles
  where auth_user_id = user_id;

  -- 2. Get MFA enrollment status (verified/active status)
  select exists(
    select 1 from public.mfa_enrollments
    where user_id = (select id from public.user_profiles where auth_user_id = user_id)
      and status = 'active'
  ) into mfa_active;

  -- 3. Get roles and branches
  if t_id is not null then
    -- Tenant role key
    select r.key into t_role
    from public.tenant_user_roles ur
    join public.tenant_roles r on ur.role_id = r.id
    where ur.user_id = (select id from public.user_profiles where auth_user_id = user_id)
      and ur.tenant_id = t_id
      and ur.deleted_at is null
      and (ur.expires_at is null or ur.expires_at > now())
    limit 1;

    -- Branch IDs
    select coalesce(json_agg(branch_id), '[]'::json) into b_ids
    from public.tenant_user_roles
    where user_id = (select id from public.user_profiles where auth_user_id = user_id)
      and tenant_id = t_id
      and deleted_at is null
      and (expires_at is null or expires_at > now())
      and branch_id is not null;
  else
    -- Platform role key
    select r.key into p_role
    from public.platform_user_roles ur
    join public.platform_roles r on ur.role_id = r.id
    where ur.user_id = user_id
      and ur.deleted_at is null
      and (ur.expires_at is null or ur.expires_at > now())
    limit 1;
  end if;

  -- Enrich claims object at root level and within app_metadata
  claims := claims || jsonb_build_object(
    'tenant_id', t_id,
    'tenant_role', t_role,
    'platform_role', p_role,
    'branch_ids', coalesce(b_ids, '[]'::jsonb),
    'mfa_enrolled', mfa_active,
    'app_metadata', coalesce(claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object(
      'tenant_id', t_id,
      'tenant_role', t_role,
      'platform_role', p_role,
      'branch_ids', coalesce(b_ids, '[]'::jsonb),
      'mfa_enrolled', mfa_active
    )
  );

  return jsonb_build_object('claims', claims);
end;
$$;

-- Grant execution permissions to supabase_auth_admin role (used by GoTrue)
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon;
