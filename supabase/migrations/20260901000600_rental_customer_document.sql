-- Stripe -> Asaas migration, Fase C (one-off customer payments): Asaas
-- requires cpfCnpj to create any customer (Stripe never did). rental_customers
-- has full_name/email/phone but no document field at all -- unlike
-- organizations.document (not null, already collected at org-creation time),
-- individual rental customers were never asked for a CPF anywhere in the
-- product. Nullable + collected lazily at first-payment time (same pattern
-- billing_accounts.stripe_customer_id already uses for lazy gateway-customer
-- creation) rather than a forced migration prompt for existing customers.
alter table rental_customers add column document text;
