import type { SupabaseClient } from "@supabase/supabase-js";

// Registro/controle apenas (item 25 do spec: "a cobrança automática...
// nunca é automática só pelo recebimento da infração" — mesma postura de
// ensureFindingCharge() no Inspection Engine). Só age quando TODAS as
// condições abaixo são verdade -- nenhuma delas sozinha basta:
//   1. responsibility_confirmed_at está setado (decisão humana explícita
//      via POST /api/infractions/:id/responsibility/confirm, nunca a
//      sugestão sozinha);
//   2. responsible_party_type === "customer" (reembolso de operador não
//      tem trilho de fatura hoje -- fica fora de escopo, documentado no
//      relatório final; tenant resolve via folha/acerto interno);
//   3. existe um pagamento to_authority já registrado com
//      amount_paid_cents -- é o valor real pago à autoridade que vira a
//      base do reembolso, nunca o valor "original" da multa (que pode ter
//      desconto de pontualidade não capturado em infractions.amount_cents).
//
// Reaproveita billing_accounts/invoices/invoice_line_items (M29) tal como
// ensureFindingCharge() -- nenhuma tabela nova, nenhum checkout automático.
export async function ensureInfractionCharge(
  db: SupabaseClient,
  infractionCase: {
    id: string;
    tenant_id: string;
    contract_id: string | null;
    responsible_party_type: string | null;
    responsible_party_id: string | null;
    responsibility_confirmed_at: string | null;
  },
): Promise<void> {
  if (!infractionCase.responsibility_confirmed_at) return;
  if (infractionCase.responsible_party_type !== "customer") return;
  if (!infractionCase.contract_id) return;

  // Idempotency -- a line item already referencing this case means the
  // charge was already registered.
  const { data: existingLine } = await db
    .from("invoice_line_items")
    .select("id")
    .eq("infraction_case_id", infractionCase.id)
    .limit(1)
    .maybeSingle();
  if (existingLine) return;

  const { data: payment } = await db
    .from("infraction_payments")
    .select("amount_paid_cents")
    .eq("case_id", infractionCase.id)
    .eq("kind", "to_authority")
    .not("amount_paid_cents", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment?.amount_paid_cents || payment.amount_paid_cents <= 0) return;

  const { data: contract } = await db
    .from("contracts")
    .select("id, organization_id")
    .eq("id", infractionCase.contract_id)
    .maybeSingle();
  if (!contract?.organization_id) return;

  const currency = "BRL";
  const amount = payment.amount_paid_cents / 100;

  let { data: billingAccount } = await db
    .from("billing_accounts")
    .select("id")
    .eq("tenant_id", infractionCase.tenant_id)
    .eq("organization_id", contract.organization_id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (!billingAccount) {
    const { data: created } = await db
      .from("billing_accounts")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: infractionCase.tenant_id,
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
    tenant_id: infractionCase.tenant_id,
    billing_account_id: billingAccount.id,
    contract_id: contract.id,
    status: "issued",
    total_amount: amount,
    total_currency: currency,
    due_date: dueDate.toISOString().slice(0, 10),
  });
  if (invoiceError) return;

  await db.from("invoice_line_items").insert({
    id: crypto.randomUUID(),
    invoice_id: invoiceId,
    tenant_id: infractionCase.tenant_id,
    infraction_case_id: infractionCase.id,
    description: "Reembolso de infração de trânsito",
    quantity: 1,
    unit_price_amount: amount,
    unit_price_currency: currency,
  });
}
