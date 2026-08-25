import type { SupabaseClient } from "@supabase/supabase-js";

// Registro/controle apenas (item 15 do spec: "Não faça cobrança automática
// baseada apenas em IA... Fluxo: AI suggestion → human confirmation →
// business rule → approval → billing") — mesma postura de
// ensureContractInvoice(): cria a fatura real no módulo de AR já existente
// (billing_accounts/invoices/invoice_line_items, M29), o tenant marca como
// paga pela tela de billing já existente. Só age quando a constatação já
// tem approved_cost_amount — ou seja, já passou por decisão humana
// explícita (a rota PATCH /api/findings/[id] é o único jeito de setar esse
// campo), nunca a partir de estimated_cost_amount sozinho.
//
// Sem contrato vinculado à inspeção, não há organização pra faturar contra
// — decisão de escopo (documentada em docs/architecture/
// INSPECTION_ENGINE.md): uma vistoria avulsa, sem contrato, não gera
// cobrança automática; o tenant cobra manualmente fora do sistema nesse
// caso.
export async function ensureFindingCharge(
  db: SupabaseClient,
  finding: {
    id: string;
    tenant_id: string;
    inspection_id: string;
    description: string;
    approved_cost_amount: number | null;
    approved_cost_currency: string | null;
  },
): Promise<void> {
  if (finding.approved_cost_amount === null || finding.approved_cost_amount <= 0) return;

  // Idempotency — a line item already referencing this finding means the
  // charge was already registered (e.g. a repeated PATCH to "chargeable").
  const { data: existingLine } = await db
    .from("invoice_line_items")
    .select("id")
    .eq("inspection_finding_id", finding.id)
    .limit(1)
    .maybeSingle();
  if (existingLine) return;

  const { data: inspection } = await db
    .from("inspections")
    .select("contract_id")
    .eq("id", finding.inspection_id)
    .maybeSingle();
  if (!inspection?.contract_id) return;

  const { data: contract } = await db
    .from("contracts")
    .select("id, organization_id")
    .eq("id", inspection.contract_id)
    .maybeSingle();
  if (!contract?.organization_id) return;

  const currency = finding.approved_cost_currency ?? "BRL";

  let { data: billingAccount } = await db
    .from("billing_accounts")
    .select("id")
    .eq("tenant_id", finding.tenant_id)
    .eq("organization_id", contract.organization_id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (!billingAccount) {
    const { data: created } = await db
      .from("billing_accounts")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: finding.tenant_id,
        organization_id: contract.organization_id,
        cycle: "one_time",
        credit_limit_amount: 0,
        credit_limit_currency: currency,
        balance_currency: currency,
      })
      .select("id")
      .single();
    billingAccount = created;
  }
  if (!billingAccount) return;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  const invoiceId = crypto.randomUUID();
  const { error: invoiceError } = await db.from("invoices").insert({
    id: invoiceId,
    tenant_id: finding.tenant_id,
    billing_account_id: billingAccount.id,
    contract_id: contract.id,
    status: "issued",
    total_amount: finding.approved_cost_amount,
    total_currency: currency,
    due_date: dueDate.toISOString().slice(0, 10),
  });
  if (invoiceError) return;

  await db.from("invoice_line_items").insert({
    id: crypto.randomUUID(),
    invoice_id: invoiceId,
    tenant_id: finding.tenant_id,
    inspection_finding_id: finding.id,
    description: `Vistoria — ${finding.description}`.slice(0, 500),
    quantity: 1,
    unit_price_amount: finding.approved_cost_amount,
    unit_price_currency: currency,
  });
}
