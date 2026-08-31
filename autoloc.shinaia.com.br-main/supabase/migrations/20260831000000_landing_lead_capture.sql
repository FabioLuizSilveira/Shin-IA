-- Landing lead + analytics capture for the marketing site (autoloc.shinaia.com.br).
--
-- The static landing has no server of its own; visitors post straight to
-- PostgREST with the public anon key. Anonymous clients may INSERT only —
-- there are no SELECT/UPDATE/DELETE policies, so the anon key can never read
-- anything back. Staff read these via the service role or a future authed view.
-- Everything is namespaced with the `landing_` prefix and is independent of the
-- platform CRM (`crm_leads`), which is tenant-scoped and needs a session.

create table if not exists public.landing_leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  email       text not null check (
                email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                and char_length(email) <= 320
              ),
  phone       text check (char_length(phone) <= 40),
  profile     text check (profile in ('locador', 'locatario')),
  fleet_size  text check (char_length(fleet_size) <= 40),
  plan        text check (char_length(plan) <= 40),
  source      text check (char_length(source) <= 120),
  locale      text not null default 'pt' check (locale in ('pt', 'en')),
  created_at  timestamptz not null default now()
);

create table if not exists public.landing_events (
  id          uuid primary key default gen_random_uuid(),
  event       text not null check (char_length(event) between 1 and 80),
  label       text check (char_length(label) <= 160),
  section     text check (char_length(section) <= 80),
  locale      text check (locale is null or locale in ('pt', 'en')),
  value       double precision,
  created_at  timestamptz not null default now()
);

create index if not exists landing_leads_created_at_idx  on public.landing_leads  (created_at desc);
create index if not exists landing_events_created_at_idx on public.landing_events (created_at desc);
create index if not exists landing_events_event_idx      on public.landing_events (event);

alter table public.landing_leads  enable row level security;
alter table public.landing_events enable row level security;

drop policy if exists landing_leads_anon_insert  on public.landing_leads;
drop policy if exists landing_events_anon_insert on public.landing_events;

create policy landing_leads_anon_insert on public.landing_leads
  for insert to anon, authenticated
  with check (true);

create policy landing_events_anon_insert on public.landing_events
  for insert to anon, authenticated
  with check (true);

-- Insert-only surface for the public roles; no select/update/delete.
revoke all on public.landing_leads  from anon, authenticated;
revoke all on public.landing_events from anon, authenticated;
grant insert on public.landing_leads  to anon, authenticated;
grant insert on public.landing_events to anon, authenticated;

notify pgrst, 'reload schema';
