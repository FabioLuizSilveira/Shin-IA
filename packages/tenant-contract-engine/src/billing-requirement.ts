import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingRequirementType = "deposit" | "full_payment" | "invoice" | "none";

export interface BillingRequirement {
  type: BillingRequirementType;
  amountCents?: number;
  currency?: string;
}

// Registro/controle apenas nesta rodada — não processa pagamento, só
// verifica se a fatura ligada ao contrato já foi marcada como paga na tela
// de billing existente (M29).
export function resolveBillingRequirement(contract: {
  billing_requirement: unknown;
}): BillingRequirement {
  const raw = (contract.billing_requirement ?? {}) as Partial<{
    type: BillingRequirementType;
    amount_cents: number;
    currency: string;
  }>;
  return {
    type: raw.type ?? "none",
    amountCents: raw.amount_cents,
    currency: raw.currency,
  };
}

export async function isBillingSatisfied(db: SupabaseClient, contractId: string): Promise<boolean> {
  const { data: contract, error: contractError } = await db
    .from("contracts")
    .select("billing_requirement")
    .eq("id", contractId)
    .single();
  if (contractError || !contract)
    throw new Error(`failed to load contract: ${contractError?.message}`);

  const requirement = resolveBillingRequirement(contract);
  if (requirement.type === "none") return true;

  const { data: invoice, error: invoiceError } = await db
    .from("invoices")
    .select("paid_at")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invoiceError) throw new Error(`failed to load invoice: ${invoiceError.message}`);

  return !!invoice?.paid_at;
}
