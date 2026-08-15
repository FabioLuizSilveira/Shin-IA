-- platform_customers' own comment already establishes this: "an MKT-only
-- buyer has no tenant, since user_profiles.tenant_id is NOT NULL" — a
-- customer can buy Shinã MKT without ever being a Shinã Platform tenant.
-- The four commercial-flow tables added in 20260072000000 all wrongly made
-- tenant_id NOT NULL, which would make it impossible for an MKT-only buyer
-- to ever accept a contract or check out. Relax to nullable, mirroring
-- platform_subscriptions.tenant_id's existing nullable pattern for the same
-- reason.

alter table commercial_terms_snapshots alter column tenant_id drop not null;
alter table contract_acceptances alter column tenant_id drop not null;
alter table plan_change_acceptances alter column tenant_id drop not null;
alter table checkout_session_references alter column tenant_id drop not null;
