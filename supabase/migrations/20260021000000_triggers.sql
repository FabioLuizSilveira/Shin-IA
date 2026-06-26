-- M021: Trigger functions and trigger bindings
-- 1. trigger_set_updated_at — applied to all tables with updated_at
-- 2. Tenant invariant triggers for denormalized child table tenant_id columns

-- ── updated_at auto-update ────────────────────────────────────────────────────
create or replace function trigger_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to every table that has an updated_at column
create trigger set_updated_at before update on tenants
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on branches
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on persons
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on organizations
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on asset_types
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on assets
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on resources
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on capabilities
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on operations
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on allocations
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on contracts
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on billing_accounts
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on invoices
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on notifications
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on workflow_definitions
  for each row execute function trigger_set_updated_at();

create trigger set_updated_at before update on rule_sets
  for each row execute function trigger_set_updated_at();

-- ── Invariant: invoice_line_items.tenant_id == invoices.tenant_id ─────────────
-- Prevents cross-tenant line items being inserted under an invoice via tenant_id drift
create or replace function trigger_assert_line_item_tenant()
returns trigger
language plpgsql
as $$
declare
  invoice_tenant_id uuid;
begin
  select tenant_id into invoice_tenant_id
  from invoices
  where id = new.invoice_id;

  if new.tenant_id <> invoice_tenant_id then
    raise exception 'invoice_line_items.tenant_id (%) must equal invoices.tenant_id (%)',
      new.tenant_id, invoice_tenant_id;
  end if;

  return new;
end;
$$;

create trigger assert_line_item_tenant before insert on invoice_line_items
  for each row execute function trigger_assert_line_item_tenant();

-- ── Invariant: workflow_steps.tenant_id == workflow_definitions.tenant_id ─────
create or replace function trigger_assert_workflow_step_tenant()
returns trigger
language plpgsql
as $$
declare
  definition_tenant_id uuid;
begin
  select tenant_id into definition_tenant_id
  from workflow_definitions
  where id = new.workflow_definition_id;

  if new.tenant_id <> definition_tenant_id then
    raise exception 'workflow_steps.tenant_id (%) must equal workflow_definitions.tenant_id (%)',
      new.tenant_id, definition_tenant_id;
  end if;

  return new;
end;
$$;

create trigger assert_workflow_step_tenant before insert on workflow_steps
  for each row execute function trigger_assert_workflow_step_tenant();

-- ── Invariant: rule_set_rules.tenant_id == rule_sets.tenant_id ───────────────
create or replace function trigger_assert_rule_set_rule_tenant()
returns trigger
language plpgsql
as $$
declare
  rule_set_tenant_id uuid;
begin
  select tenant_id into rule_set_tenant_id
  from rule_sets
  where id = new.rule_set_id;

  if new.tenant_id <> rule_set_tenant_id then
    raise exception 'rule_set_rules.tenant_id (%) must equal rule_sets.tenant_id (%)',
      new.tenant_id, rule_set_tenant_id;
  end if;

  return new;
end;
$$;

create trigger assert_rule_set_rule_tenant before insert on rule_set_rules
  for each row execute function trigger_assert_rule_set_rule_tenant();
