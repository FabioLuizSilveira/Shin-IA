-- M016: notifications — messages to persons or external recipients
-- Decision #3: person_id FK nullable + recipient_external_ref TEXT nullable
-- CHECK ensures at least one of the two is non-null (recipient invariant)
-- person_id ON DELETE SET NULL preserves notification history when person is removed

create table notifications (
  id                      uuid                  primary key,
  tenant_id               uuid                  not null,
  person_id               uuid,
  recipient_external_ref  text,
  channel                 notification_channel  not null,
  priority                notification_priority not null default 'normal',
  subject                 text                  not null,
  body                    text                  not null,
  status                  notification_status   not null default 'pending',
  sent_at                 timestamptz,
  read_at                 timestamptz,
  version                 integer               not null default 1,
  metadata                jsonb                 not null default '{}',
  created_at              timestamptz           not null default now(),
  updated_at              timestamptz           not null default now(),
  deleted_at              timestamptz,

  constraint notifications_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete restrict,
  constraint notifications_person_fk
    foreign key (person_id) references persons (id) on delete set null,

  constraint notifications_recipient_required
    check (person_id is not null or recipient_external_ref is not null)
);

create index notifications_tenant_id_idx on notifications (tenant_id);
create index notifications_tenant_status_idx on notifications (tenant_id, status);
create index notifications_person_id_idx on notifications (person_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table notifications enable row level security;
alter table notifications force row level security;

create policy "notifications_select"
  on notifications for select
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "notifications_insert"
  on notifications for insert
  to authenticated
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "notifications_update"
  on notifications for update
  to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
