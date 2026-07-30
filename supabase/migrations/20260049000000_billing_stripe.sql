-- M049: Stripe payment fields for the existing AR (billing_accounts/invoices)
-- module. Adds real payment collection on top of the manual status
-- transitions that already exist — Stripe is one more payment method, not
-- a replacement for cash/bank-transfer reconciliation.

alter table billing_accounts
  add column stripe_customer_id text;

alter table invoices
  add column stripe_checkout_session_id text,
  add column stripe_payment_intent_id text;

create index invoices_stripe_checkout_session_idx
  on invoices (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
