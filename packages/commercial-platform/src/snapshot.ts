import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePlanVersion } from "./contract-requirement.js";
import type { ContractVersion, Product } from "./types.js";

// Immutable copy of exactly what was presented at acceptance time — never
// re-derived from current plan/contract config later (item 3/4 of the spec:
// "nunca determinar contrato histórico olhando configuração atual").
export async function createCommercialTermsSnapshot(
  db: SupabaseClient,
  input: {
    tenantId: string | null;
    userId: string;
    product: Product;
    planVersionId: string;
    contractVersion: ContractVersion;
  },
): Promise<{ id: string }> {
  const planVersion = await resolvePlanVersion(db, input.planVersionId);

  const { data, error } = await db
    .from("commercial_terms_snapshots")
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      product: input.product,
      plan_id: planVersion.plan_id,
      plan_version_id: planVersion.id,
      contract_version_id: input.contractVersion.id,
      price_cents: planVersion.price_cents,
      currency: planVersion.currency,
      billing_cycle: planVersion.billing_cycle,
      trial_days: planVersion.trial_days,
      commitment_period_months: planVersion.commitment_period_months,
      included_features: planVersion.included_features,
      usage_limits: planVersion.usage_limits,
      overage_rules: planVersion.overage_rules,
      discount_rules: planVersion.discount_rules,
      revenue_share: planVersion.revenue_share,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`snapshot insert failed: ${error?.message}`);

  return data;
}
