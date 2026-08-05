-- Security fix (MÉD-13): rental_service_requests_insert_own validated that
-- rental_customer_id and contract_id belong to the caller, but never
-- validated the client-supplied tenant_id column against the contract's
-- real tenant — a forged tenant_id on an otherwise-legitimate request hid
-- it from the real tenant's staff (tenant_id mismatch) or, if it happened
-- to collide with another real tenant's id, surfaced it to that unrelated
-- tenant's staff view. tenant_id is now derived from the contract itself,
-- not trusted from the client.

drop policy if exists "rental_service_requests_insert_own" on rental_service_requests;

create policy "rental_service_requests_insert_own"
  on rental_service_requests for insert
  to authenticated
  with check (
    rental_customer_id in (select id from rental_customers where auth_user_id = auth.uid())
    and contract_id in (
      select c.id
      from contracts c
      join rental_customer_organizations rco on rco.organization_id = c.organization_id
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
    and tenant_id = (select c.tenant_id from contracts c where c.id = contract_id)
  );
