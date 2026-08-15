import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingProvider } from "@shina/billing-platform";
import { resolvePlanVersion } from "./contract-requirement.js";
import type { CreateCommercialCheckoutInput } from "./types.js";

// Single checkout entry point for BOTH products — creates the reconciliation
// row first (checkout_session_references), then asks the billing provider
// (unchanged, existing @shina/billing-platform) to create the actual Stripe
// Checkout Session, carrying our own row id in metadata so the webhook can
// resolve it later without needing a schema change to the shared billing
// package (item 15: "Checkout Session deve carregar referências suficientes
// para reconciliação no webhook").
export async function createCommercialCheckout(
  db: SupabaseClient,
  billingProvider: BillingProvider,
  input: CreateCommercialCheckoutInput,
): Promise<{ url: string; checkoutRefId: string }> {
  const planVersion = await resolvePlanVersion(db, input.planVersionId);
  if (!planVersion.stripe_price_id) {
    throw new Error(
      `plan version ${input.planVersionId} has no stripe_price_id configured — cannot checkout`,
    );
  }

  const { data: ref, error } = await db
    .from("checkout_session_references")
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      product: input.product,
      plan_version_id: input.planVersionId,
      commercial_terms_snapshot_id: input.commercialTermsSnapshotId,
      contract_acceptance_id: input.contractAcceptanceId,
      provider: "stripe",
      status: "open",
    })
    .select("id")
    .single();
  if (error || !ref) throw new Error(`checkout reference insert failed: ${error?.message}`);

  const { url } = await billingProvider.createCheckout({
    authUserId: input.userId,
    email: input.email,
    product: input.product,
    planKey: planVersion.plans?.key ?? "unknown",
    priceId: planVersion.stripe_price_id,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    trialPeriodDays: planVersion.trial_days > 0 ? planVersion.trial_days : undefined,
    metadata: {
      checkout_ref_id: ref.id,
      ...(input.tenantId ? { tenant_id: input.tenantId } : {}),
      plan_version_id: input.planVersionId,
      contract_acceptance_id: input.contractAcceptanceId,
      commercial_terms_snapshot_id: input.commercialTermsSnapshotId,
      ...input.extraMetadata,
    },
  });

  return { url, checkoutRefId: ref.id };
}
