-- Shinã Messaging Platform — WAVE 1 (Official WhatsApp Foundation) schema.
--
-- Provider-agnostic messaging infrastructure, modeled directly on
-- @shina/signature-platform's own schema (signature_requests/signers/
-- artifacts/webhook_events) — same posture: canonical Shinã concepts only,
-- no Meta/WhatsApp-specific nomenclature in any table, `provider` is free
-- text (not an enum) so a second provider never needs a migration, RLS is
-- select-only for `authenticated` with all writes going through the
-- service-role admin client (requireTenantScope's model), and a webhook
-- idempotency log keyed on (provider, provider_event_id) BEFORE any side
-- effect.
--
-- Multi-tenant isolation (P0 absolute, per spec section 4): every table
-- that isn't purely a webhook/credential log carries tenant_id with an FK
-- to tenants + a select-only RLS policy scoped to
-- (auth.jwt() ->> 'tenant_id')::uuid. A MessagingChannel's tenant is
-- resolved SERVER-SIDE from its own row (webhook lookup by
-- external_phone_number_id -> messaging_channels.tenant_id) — never
-- trusted from a webhook payload or a client request body.

create type messaging_channel_status as enum (
  'pending', 'connected', 'suspended', 'disconnected', 'error'
);

create type messaging_connection_mode as enum (
  'cloud_api', 'coexistence_if_supported'
);

create type messaging_conversation_status as enum (
  'open', 'pending', 'closed', 'archived'
);

create type messaging_participant_type as enum (
  'customer', 'tenant_user', 'operator', 'system', 'ai_agent', 'unknown_contact'
);

create type messaging_direction as enum ('inbound', 'outbound');

create type messaging_type as enum (
  'text', 'image', 'video', 'audio', 'document', 'location', 'contact',
  'template', 'interactive', 'system'
);

create type messaging_status as enum (
  'received', 'queued', 'sent', 'delivered', 'read', 'failed'
);

create type messaging_template_status as enum (
  'draft', 'submitted', 'approved', 'rejected', 'paused', 'disabled'
);

create type messaging_consent_purpose as enum (
  'operational', 'transactional', 'support', 'marketing'
);

create type messaging_consent_status as enum (
  'granted', 'revoked', 'not_required_if_legally_applicable'
);

-- ── messaging_channels ───────────────────────────────────────────────────
-- One row per connected number/account. Never carries a credential/token
-- column (see messaging_channel_credentials) — spec section 3: "Nunca usar
-- credencial/token como campo retornável ao frontend" is enforced
-- structurally, not just by convention, by keeping secrets in a separate,
-- RLS-policy-less table.
create table if not exists messaging_channels (
  id                            uuid                        primary key default gen_random_uuid(),
  tenant_id                     uuid                        not null,
  provider                      text                        not null default 'whatsapp',
  external_business_account_id  text,
  external_phone_number_id      text,
  external_account_id           text,
  display_phone_number          text,
  display_name                  text,
  status                        messaging_channel_status    not null default 'pending',
  connection_mode               messaging_connection_mode   not null default 'cloud_api',
  branch_id                     uuid,
  purpose                       text,
  created_at                    timestamptz                 not null default now(),
  connected_at                  timestamptz,
  disconnected_at               timestamptz,

  constraint messaging_channels_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint messaging_channels_branch_fk
    foreign key (branch_id) references branches (id) on delete set null
);

create index messaging_channels_tenant_id_idx on messaging_channels (tenant_id);
-- The webhook's ONLY server-side lookup key: external_phone_number_id ->
-- tenant. Unique across all tenants (a real Meta phone number ID can only
-- ever belong to one WABA connection at a time).
create unique index messaging_channels_external_phone_unique
  on messaging_channels (provider, external_phone_number_id)
  where external_phone_number_id is not null;

alter table messaging_channels enable row level security;
alter table messaging_channels force row level security;
create policy "messaging_channels_select_own_tenant" on messaging_channels
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── messaging_channel_credentials ────────────────────────────────────────
-- Server-side only — no RLS select policy for `authenticated` at all (same
-- posture as signature_webhook_events / platform_billing_events for
-- data that must never reach a client, even indirectly through
-- PostgREST). access_token stored in plain text: this repo has no
-- confirmed encryption-at-rest primitive today (pgcrypto is NOT enabled —
-- see 20260062000000_fleet_integration_webhook_secret.sql's own comment;
-- Supabase Vault/pgsodium availability not verified either). That matches
-- this codebase's existing bar for third-party secrets (CLICKSIGN_API_KEY,
-- Asaas credentials are plain env vars too) but is a REAL, FLAGGED gap for
-- a genuine per-tenant OAuth-style access token living in a DB row rather
-- than a platform-wide env var — do not connect a real tenant WABA before
-- deciding on pgcrypto/Vault/KMS for this table.
create table if not exists messaging_channel_credentials (
  messaging_channel_id  uuid          primary key,
  access_token          text,
  token_expires_at      timestamptz,
  updated_at            timestamptz   not null default now(),

  constraint messaging_channel_credentials_channel_fk
    foreign key (messaging_channel_id) references messaging_channels (id) on delete cascade
);

alter table messaging_channel_credentials enable row level security;
alter table messaging_channel_credentials force row level security;
-- Deliberately no policies at all — zero access for `authenticated`/`anon`.

-- ── conversations ────────────────────────────────────────────────────────
create table if not exists conversations (
  id                        uuid                            primary key default gen_random_uuid(),
  tenant_id                 uuid                            not null,
  messaging_channel_id      uuid                            not null,
  external_conversation_key text,
  status                    messaging_conversation_status   not null default 'open',
  assigned_user_id          uuid,
  assigned_team_id          uuid,
  contact_id                uuid,
  customer_id               uuid,
  last_message_at           timestamptz,
  created_at                timestamptz                     not null default now(),
  updated_at                timestamptz                     not null default now(),

  constraint conversations_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint conversations_channel_fk
    foreign key (messaging_channel_id) references messaging_channels (id) on delete cascade
);

create index conversations_tenant_id_idx on conversations (tenant_id);
create index conversations_channel_id_idx on conversations (messaging_channel_id);
create index conversations_status_idx on conversations (tenant_id, status);
-- One open conversation per external contact key per channel — inbound
-- messages upsert onto this instead of forking a new conversation per
-- message.
create unique index conversations_channel_external_key_unique
  on conversations (messaging_channel_id, external_conversation_key)
  where external_conversation_key is not null and status in ('open', 'pending');

alter table conversations enable row level security;
alter table conversations force row level security;
create policy "conversations_select_own_tenant" on conversations
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── conversation_participants ────────────────────────────────────────────
create table if not exists conversation_participants (
  id                uuid                          primary key default gen_random_uuid(),
  tenant_id         uuid                          not null,
  conversation_id   uuid                          not null,
  participant_type  messaging_participant_type    not null,
  -- Exactly one of these is set, matching participant_type — enforced in
  -- application code (createParticipant()), not a check constraint, since
  -- "system"/"ai_agent"/"unknown_contact" legitimately have none.
  user_id           uuid,
  customer_id       uuid,
  operator_id       uuid,
  external_wa_id     text,
  display_name      text,
  created_at        timestamptz                   not null default now(),

  constraint conversation_participants_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint conversation_participants_conversation_fk
    foreign key (conversation_id) references conversations (id) on delete cascade
);

create index conversation_participants_conversation_id_idx
  on conversation_participants (conversation_id);
create index conversation_participants_tenant_id_idx
  on conversation_participants (tenant_id);

alter table conversation_participants enable row level security;
alter table conversation_participants force row level security;
create policy "conversation_participants_select_own_tenant" on conversation_participants
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── messages ─────────────────────────────────────────────────────────────
create table if not exists messages (
  id                  uuid                primary key default gen_random_uuid(),
  tenant_id           uuid                not null,
  conversation_id     uuid                not null,
  direction           messaging_direction not null,
  sender_type         messaging_participant_type not null,
  sender_id           uuid,
  provider_message_id text,
  type                messaging_type      not null,
  body                text,
  media_ref           text,
  metadata            jsonb               not null default '{}'::jsonb,
  status              messaging_status    not null default 'received',
  created_at          timestamptz         not null default now(),

  constraint messages_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint messages_conversation_fk
    foreign key (conversation_id) references conversations (id) on delete cascade
);

create index messages_conversation_id_idx on messages (conversation_id, created_at);
create index messages_tenant_id_idx on messages (tenant_id);
create unique index messages_provider_message_id_unique
  on messages (provider_message_id)
  where provider_message_id is not null;

alter table messages enable row level security;
alter table messages force row level security;
create policy "messages_select_own_tenant" on messages
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── message_templates ────────────────────────────────────────────────────
-- tenant_id nullable: a template can be a Shinã-provided default (shared
-- across tenants, tenant_id null) or tenant-authored (tenant_id set).
create table if not exists message_templates (
  id                   uuid                        primary key default gen_random_uuid(),
  tenant_id            uuid,
  provider             text                        not null default 'whatsapp',
  provider_template_id text,
  name                 text                        not null,
  language             text                        not null,
  category             text,
  version              integer                     not null default 1,
  status               messaging_template_status   not null default 'draft',
  components           jsonb                       not null default '[]'::jsonb,
  created_at           timestamptz                 not null default now(),

  constraint message_templates_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index message_templates_tenant_id_idx on message_templates (tenant_id);
create unique index message_templates_tenant_name_lang_unique
  on message_templates (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), name, language);

alter table message_templates enable row level security;
alter table message_templates force row level security;
-- Shared (tenant_id null) templates are readable by anyone authenticated;
-- tenant-authored ones only by their own tenant.
create policy "message_templates_select" on message_templates
  for select to authenticated
  using (tenant_id is null or tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── communication_consents ───────────────────────────────────────────────
create table if not exists communication_consents (
  id          uuid                          primary key default gen_random_uuid(),
  tenant_id   uuid                          not null,
  person_id   uuid,
  channel     text                          not null default 'whatsapp',
  purpose     messaging_consent_purpose     not null,
  status      messaging_consent_status     not null,
  source      text                          not null,
  evidence    jsonb,
  granted_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz                   not null default now(),

  constraint communication_consents_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

create index communication_consents_tenant_id_idx on communication_consents (tenant_id);
create index communication_consents_person_idx on communication_consents (tenant_id, person_id, purpose);

alter table communication_consents enable row level security;
alter table communication_consents force row level security;
create policy "communication_consents_select_own_tenant" on communication_consents
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── messaging_usage_events ───────────────────────────────────────────────
-- Financial history is append-only and NEVER retroactively repriced (spec
-- section 24) — a future PricingPolicy change only affects new events.
create table if not exists messaging_usage_events (
  id                    uuid          primary key default gen_random_uuid(),
  tenant_id             uuid          not null,
  channel               text          not null default 'whatsapp',
  provider              text          not null default 'whatsapp',
  message_type          messaging_type,
  category              text,
  provider_message_id   text,
  provider_cost_cents   integer,
  customer_cost_cents   integer,
  conversation_id       uuid,
  occurred_at           timestamptz   not null default now(),

  constraint messaging_usage_events_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint messaging_usage_events_conversation_fk
    foreign key (conversation_id) references conversations (id) on delete set null
);

create index messaging_usage_events_tenant_id_idx on messaging_usage_events (tenant_id, occurred_at);

alter table messaging_usage_events enable row level security;
alter table messaging_usage_events force row level security;
create policy "messaging_usage_events_select_own_tenant" on messaging_usage_events
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── messaging_webhook_events ─────────────────────────────────────────────
-- Idempotency log, same shape as signature_webhook_events: logged FIRST,
-- before any side effect, under a composite unique index. No tenant_id
-- (tenant is only known indirectly, via the resolved messaging_channel) —
-- service-role only, no `authenticated` policy at all.
create table if not exists messaging_webhook_events (
  id                 uuid          primary key default gen_random_uuid(),
  provider            text          not null,
  provider_event_id   text          not null,
  event_type          text          not null,
  payload             jsonb         not null default '{}'::jsonb,
  messaging_channel_id uuid,
  processed_at        timestamptz,
  created_at          timestamptz   not null default now(),

  constraint messaging_webhook_events_channel_fk
    foreign key (messaging_channel_id) references messaging_channels (id) on delete set null
);

create unique index messaging_webhook_events_provider_event_unique
  on messaging_webhook_events (provider, provider_event_id);
create index messaging_webhook_events_channel_id_idx
  on messaging_webhook_events (messaging_channel_id);

alter table messaging_webhook_events enable row level security;
alter table messaging_webhook_events force row level security;

-- ── IAM — provider-neutral permission catalog (spec section 32) ─────────
insert into tenant_permissions (key, resource, action, name, is_system)
select v.key, v.resource, v.action, v.name, true
from (values
  ('messaging.channel.read', 'messaging_channel', 'read', 'Ver canais de mensageria'),
  ('messaging.channel.manage', 'messaging_channel', 'manage', 'Conectar/desconectar canais de mensageria'),
  ('messaging.conversation.read', 'messaging_conversation', 'read', 'Ver conversas'),
  ('messaging.conversation.reply', 'messaging_conversation', 'reply', 'Responder conversas'),
  ('messaging.conversation.assign', 'messaging_conversation', 'assign', 'Atribuir conversas'),
  ('messaging.conversation.close', 'messaging_conversation', 'close', 'Encerrar conversas'),
  ('messaging.template.read', 'messaging_template', 'read', 'Ver modelos de mensagem'),
  ('messaging.template.manage', 'messaging_template', 'manage', 'Gerenciar modelos de mensagem'),
  ('messaging.automation.read', 'messaging_automation', 'read', 'Ver automações de mensageria'),
  ('messaging.automation.manage', 'messaging_automation', 'manage', 'Gerenciar automações de mensageria'),
  ('messaging.analytics.read', 'messaging_analytics', 'read', 'Ver métricas de mensageria')
) as v(key, resource, action, name)
where not exists (
  select 1 from tenant_permissions where key = v.key and deleted_at is null
);

insert into tenant_role_permissions (role_id, permission_id)
select tr.id, tp.id
from tenant_roles tr
cross join tenant_permissions tp
where tr.key in ('tenant_owner', 'tenant_admin')
  and tp.key like 'messaging.%'
on conflict do nothing;
