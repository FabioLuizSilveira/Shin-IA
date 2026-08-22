-- Security fix, same session: PostgreSQL grants EXECUTE on every new
-- function to PUBLIC by default. 20260095000000's `revoke ... from
-- authenticated, anon` did not remove that implicit PUBLIC grant, and every
-- role (including anon/authenticated) is implicitly a member of PUBLIC —
-- so any anonymous caller could call resolve_shina_authorization_context(
-- uuid) via PostgREST's /rpc/ endpoint for ANY user id, leaking their
-- tenant_id/tenant_role/platform_role/subscription status. Confirmed live
-- against the hosted project before this fix (anon key: 200 with real
-- data), and confirmed blocked (empty error) after.
revoke execute on function public.resolve_shina_authorization_context from public;
revoke execute on function public.resolve_shina_authorization_context from authenticated, anon;
grant execute on function public.resolve_shina_authorization_context to service_role;
