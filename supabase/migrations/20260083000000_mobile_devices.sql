-- Wave 3 Phase D — push notification registration foundation. No push
-- provider (Expo/FCM/APNs) is wired up yet, this table only stores the
-- association between an authenticated user and a device's push token so a
-- provider integration can be plugged in later without another migration.
-- push_delivery_provider = pending, documented in the mobile OpenAPI spec.

create table mobile_devices (
  id             uuid          primary key default gen_random_uuid(),
  user_id        uuid          not null,
  device_id      text          not null,
  push_token     text,
  platform       text          not null,
  app_version    text,
  last_seen_at   timestamptz   not null default now(),
  enabled        boolean       not null default true,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),

  constraint mobile_devices_platform_check
    check (platform in ('ios', 'android'))
);

-- One row per physical device install, re-registered (upserted) on every
-- login/app-open rather than accumulating duplicates.
create unique index mobile_devices_device_id_unique on mobile_devices (device_id);
create index mobile_devices_user_id_idx on mobile_devices (user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table mobile_devices enable row level security;
alter table mobile_devices force row level security;

-- Same lightweight pattern already used for rental_customers/operators —
-- user_id is plain uuid (== auth.uid()), no FK to auth.users, RLS is the
-- only enforcement. A device only ever belongs to the user who registered
-- it; no tenant-staff visibility into other users' devices is needed.
create policy "mobile_devices_select_own"
  on mobile_devices for select
  to authenticated
  using (user_id = auth.uid());

create policy "mobile_devices_insert_own"
  on mobile_devices for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "mobile_devices_update_own"
  on mobile_devices for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
