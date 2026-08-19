-- Rental customers previously had zero visibility into (a) the tenant's
-- broader available fleet — assets_select_rental_customer only ever let
-- them see the specific asset(s) already on their own contract_assets rows
-- — and (b) their own billing_accounts/invoices at all (no policy existed).
-- Both are needed for the customer app's renewal screen: browsing
-- available upgrade options and seeing what a renewal would be billed.
-- Same no-API-layer, RLS-only posture as the rest of the rental_customer
-- family (see 20260055000000's header comment).

-- Available fleet within a tenant the customer actually rents from — never
-- the whole assets table, and never anything but status='available' (no
-- browsing other customers' in-use vehicles).
create policy "assets_select_rental_customer_catalog"
  on assets for select
  to authenticated
  using (
    status = 'available'
    and tenant_id in (
      select rco.tenant_id
      from rental_customer_organizations rco
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );

create policy "billing_accounts_select_rental_customer"
  on billing_accounts for select
  to authenticated
  using (
    organization_id in (
      select rco.organization_id
      from rental_customer_organizations rco
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );

create policy "invoices_select_rental_customer"
  on invoices for select
  to authenticated
  using (
    billing_account_id in (
      select ba.id
      from billing_accounts ba
      join rental_customer_organizations rco on rco.organization_id = ba.organization_id
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );

create policy "invoice_line_items_select_rental_customer"
  on invoice_line_items for select
  to authenticated
  using (
    invoice_id in (
      select i.id
      from invoices i
      join billing_accounts ba on ba.id = i.billing_account_id
      join rental_customer_organizations rco on rco.organization_id = ba.organization_id
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );
