-- Platform subscription billing — Shinã charging its own users/tenants.
--
-- Distinct bounded context from the AR module (billing_accounts/invoices,
-- see 20260049000000_billing_stripe.sql): that one models a tenant invoicing
-- ITS OWN customers (organizations). These tables model Shinã's own SaaS
-- subscriptions across products ('platform' = tenant seats on apps/web,
-- 'mkt' = Shinã MKT on apps/mkt). Hence the platform_ prefix — do not merge
-- with billing_accounts.stripe_customer_id, which is a different Stripe
-- customer relationship entirely.

create type subscription_product as enum ('platform', 'mkt');

create type platform_subscription_status as enum (
  'pending',
  'trialing',
  'active',
  'past_due',
  'suspended',
  'cancelled'
);

-- One row per paying identity (keyed on auth.users directly — an MKT-only
-- buyer has no user_profiles row, since user_profiles.tenant_id is NOT NULL).
create table if not exists platform_customers (
  id                 uuid          primary key default gen_random_uuid(),
  auth_user_id       uuid          not null,
  stripe_customer_id text,
  email              text,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

create unique index platform_customers_auth_user_unique
  on platform_customers (auth_user_id);

create unique index platform_customers_stripe_unique
  on platform_customers (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists platform_subscriptions (
  id                     uuid          primary key default gen_random_uuid(),
  customer_id            uuid          not null,
  tenant_id              uuid, -- null for mkt-only subscriptions
  product                subscription_product not null,
  plan_key               text          not null, -- free text: plan vocabularies differ per product
  status                 platform_subscription_status not null default 'pending',
  stripe_subscription_id text,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  trial_ends_at          timestamptz,
  cancel_at_period_end   boolean       not null default false,
  cancelled_at           timestamptz,
  metadata               jsonb         not null default '{}',
  created_at             timestamptz   not null default now(),
  updated_at             timestamptz   not null default now(),

  constraint platform_subscriptions_customer_fk
    foreign key (customer_id) references platform_customers (id) on delete cascade,

  constraint platform_subscriptions_tenant_fk
    foreign key (tenant_id) references tenants (id) on delete cascade
);

-- One live subscription per customer per product.
create unique index platform_subscriptions_customer_product_unique
  on platform_subscriptions (customer_id, product)
  where status not in ('cancelled');

create unique index platform_subscriptions_stripe_unique
  on platform_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index platform_subscriptions_tenant_id_idx on platform_subscriptions (tenant_id);
create index platform_subscriptions_status_idx on platform_subscriptions (status);

-- Append-only webhook event log. stripe_event_id's unique index is the
-- idempotency guard: syncWebhook inserts here first and skips processing
-- when the event was already seen.
create table if not exists platform_billing_events (
  id              uuid          primary key default gen_random_uuid(),
  provider        text          not null default 'stripe',
  event_type      text          not null,
  stripe_event_id text,
  payload         jsonb         not null default '{}',
  subscription_id uuid,
  processed_at    timestamptz,
  created_at      timestamptz   not null default now(),

  constraint platform_billing_events_subscription_fk
    foreign key (subscription_id) references platform_subscriptions (id) on delete set null
);

create unique index platform_billing_events_stripe_event_unique
  on platform_billing_events (stripe_event_id)
  where stripe_event_id is not null;

create index platform_billing_events_event_type_idx on platform_billing_events (event_type);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Deny-by-default: all writes go through the service role (webhook handlers,
-- provisioning routes). Authenticated users may only read their own rows.

alter table platform_customers enable row level security;
alter table platform_customers force row level security;

create policy "platform_customers_select_own"
  on platform_customers for select
  to authenticated
  using (auth_user_id = auth.uid());

alter table platform_subscriptions enable row level security;
alter table platform_subscriptions force row level security;

create policy "platform_subscriptions_select_own"
  on platform_subscriptions for select
  to authenticated
  using (
    customer_id in (select id from platform_customers where auth_user_id = auth.uid())
    or tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

alter table platform_billing_events enable row level security;
alter table platform_billing_events force row level security;
-- No select policy at all — event payloads may carry raw gateway data;
-- service-role-only access, same posture as platform_permissions.
