-- OperatorTerms (Fase I) anchors its snapshot/acceptance on a lightweight
-- `contracts` row, but a standing Tenant<->Operator agreement has no
-- customer organization counterpart — same shape of gap already solved for
-- `commercial_terms_snapshots.tenant_id` (MKT-only buyers) earlier this
-- session: relax the not-null constraint instead of forcing a placeholder
-- organization row into existence.
alter table contracts alter column organization_id drop not null;

drop policy if exists "contracts_select_rental_customer" on contracts;
create policy "contracts_select_rental_customer"
  on contracts for select
  to authenticated
  using (
    organization_id is not null
    and organization_id in (
      select rco.organization_id
      from rental_customer_organizations rco
      join rental_customers rc on rc.id = rco.rental_customer_id
      where rc.auth_user_id = auth.uid()
    )
  );
