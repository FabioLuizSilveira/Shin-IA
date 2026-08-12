-- Two additions to close the "sino colorido até ler" request:
--
-- 1. support_messages: a genuinely new feature — there was no tenant<->
--    platform communication channel of any kind before this. Same posture
--    as tenant_activity_log (select-only RLS for tenant staff via JWT
--    tenant_id, all writes through the service-role admin client). Platform
--    staff have no tenant_id of their own, so their access is enforced at
--    the API layer (requirePlatformRole()), not via RLS — same pattern as
--    platform_roles/platform_user_roles.
--
-- 2. A trigger auto-creating a tenant notification when a rental customer
--    submits a service request — closing the other half of "cliente <->
--    tenant" that createNotification() never covered (rental customers
--    insert directly via RLS, bypassing any API route that could call it).

create table if not exists support_messages (
  id                 uuid          primary key default gen_random_uuid(),
  tenant_id          uuid          not null,
  sender_role        text          not null check (sender_role in ('tenant', 'platform')),
  sender_user_id     uuid,
  body               text          not null,
  created_at         timestamptz   not null default now(),
  read_by_tenant_at    timestamptz,
  read_by_platform_at  timestamptz,

  constraint support_messages_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index support_messages_tenant_id_idx on support_messages (tenant_id);
create index support_messages_tenant_created_idx
  on support_messages (tenant_id, created_at desc);
create index support_messages_unread_platform_idx
  on support_messages (tenant_id) where read_by_platform_at is null;

alter table support_messages enable row level security;
alter table support_messages force row level security;

create policy "support_messages_select"
  on support_messages for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── Auto-notify tenant on a new client service request ─────────────────────
create or replace function public.notify_tenant_on_service_request()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.notifications (id, tenant_id, recipient_external_ref, channel, priority, subject, body, status)
  values (
    gen_random_uuid(),
    new.tenant_id,
    'tenant:' || new.tenant_id::text,
    'in_app',
    'normal',
    case new.type
      when 'extension' then 'Novo pedido de prorrogação'
      else 'Novo problema reportado'
    end,
    new.message,
    'pending'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_tenant_on_service_request on rental_service_requests;
create trigger trg_notify_tenant_on_service_request
  after insert on rental_service_requests
  for each row execute function public.notify_tenant_on_service_request();
