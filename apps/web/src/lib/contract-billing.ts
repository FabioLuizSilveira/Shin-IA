import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBillingRequirement } from "@shina/tenant-contract-engine";

// Registro/controle apenas (Fase G) — cria a fatura real no módulo de AR já
// existente (billing_accounts/invoices, M29) quando um contrato com
// exigência de pagamento é aceito; o tenant marca a fatura como paga pela
// tela de billing já existente. Nenhuma cobrança automática acontece aqui.
export async function ensureContractInvoice(
  db: SupabaseClient,
  contract: {
    id: string;
    tenant_id: string;
    organization_id: string;
    billing_requirement: unknown;
  },
): Promise<void> {
  const requirement = resolveBillingRequirement(contract);
  if (requirement.type === "none") return;

  const { data: existing } = await db
    .from("invoices")
    .select("id")
    .eq("contract_id", contract.id)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  let { data: billingAccount } = await db
    .from("billing_accounts")
    .select("id")
    .eq("tenant_id", contract.tenant_id)
    .eq("organization_id", contract.organization_id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (!billingAccount) {
    const { data: created } = await db
      .from("billing_accounts")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: contract.tenant_id,
        organization_id: contract.organization_id,
        cycle: "one_time",
        credit_limit_amount: 0,
        credit_limit_currency: requirement.currency ?? "BRL",
        balance_currency: requirement.currency ?? "BRL",
      })
      .select("id")
      .single();
    billingAccount = created;
  }
  if (!billingAccount) return;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  await db.from("invoices").insert({
    id: crypto.randomUUID(),
    tenant_id: contract.tenant_id,
    billing_account_id: billingAccount.id,
    contract_id: contract.id,
    status: "issued",
    total_amount: (requirement.amountCents ?? 0) / 100,
    total_currency: requirement.currency ?? "BRL",
    due_date: dueDate.toISOString().slice(0, 10),
  });
}
