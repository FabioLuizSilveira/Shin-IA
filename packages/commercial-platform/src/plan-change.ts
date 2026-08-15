import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingProvider } from "@shina/billing-platform";
import { resolvePlanVersion, resolveRequiredContract } from "./contract-requirement.js";
import { createCommercialTermsSnapshot } from "./snapshot.js";
import { hasAcceptedCurrentContract } from "./acceptance.js";
import type { Product, RequestContext } from "./types.js";

export interface ChangePlanInput {
  tenantId: string | null;
  userId: string;
  product: Product;
  toPlanVersionId: string;
  request: RequestContext;
}

export interface ChangePlanResult {
  planChangeAcceptanceId: string;
  fromPlanVersionId: string | null;
  toPlanVersionId: string;
  direction: "up" | "down" | "same";
}

// Upgrade/downgrade (item 20/21): if the tenant already has the current
// contract version accepted, changing plans only needs a COMMERCIAL
// acceptance (plan_change_acceptances), never a new legal one — that's the
// whole point of separating the two tables. If the contract itself is
// pending re-acceptance (material change, Fase F's gate), this throws and
// the caller should redirect to re-accept first.
export async function changePlan(
  db: SupabaseClient,
  billingProvider: BillingProvider,
  input: ChangePlanInput,
): Promise<ChangePlanResult> {
  const hasContract = await hasAcceptedCurrentContract(db, {
    tenantId: input.tenantId,
    userId: input.userId,
    product: input.product,
  });
  if (!hasContract) {
    throw new Error("contract_reacceptance_required");
  }

  // platform_subscriptions has a unique (customer_id, product) constraint
  // among non-cancelled rows — customer_id + product alone disambiguates,
  // whether or not this product is tenant-scoped.
  const { data: customer } = await db
    .from("platform_customers")
    .select("id")
    .eq("auth_user_id", input.userId)
    .maybeSingle();
  if (!customer) throw new Error("no billing customer found for this user");

  const { data: subscription, error: subError } = await db
    .from("platform_subscriptions")
    .select("id, plan_version_id, stripe_subscription_id")
    .eq("customer_id", customer.id)
    .eq("product", input.product)
    .neq("status", "cancelled")
    .maybeSingle();
  if (subError || !subscription) throw new Error("active subscription not found");
  if (!subscription.stripe_subscription_id) {
    throw new Error("subscription has no gateway id — cannot change plan");
  }

  const toPlanVersion = await resolvePlanVersion(db, input.toPlanVersionId);
  if (!toPlanVersion.stripe_price_id) {
    throw new Error(`target plan version ${input.toPlanVersionId} has no stripe_price_id`);
  }

  let direction: "up" | "down" | "same" = "same";
  if (subscription.plan_version_id) {
    const fromPlanVersion = await resolvePlanVersion(db, subscription.plan_version_id);
    const fromPriceCents: number = fromPlanVersion.price_cents;
    if (toPlanVersion.price_cents > fromPriceCents) direction = "up";
    else if (toPlanVersion.price_cents < fromPriceCents) direction = "down";
  }

  const contractVersion = await resolveRequiredContract(db, input.product);
  const snapshot = await createCommercialTermsSnapshot(db, {
    tenantId: input.tenantId,
    userId: input.userId,
    product: input.product,
    planVersionId: input.toPlanVersionId,
    contractVersion,
  });

  const { data: acceptance, error: acceptanceError } = await db
    .from("plan_change_acceptances")
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      product: input.product,
      from_plan_version_id: subscription.plan_version_id,
      to_plan_version_id: input.toPlanVersionId,
      commercial_terms_snapshot_id: snapshot.id,
      ip_address: input.request.ipAddress,
      user_agent: input.request.userAgent,
    })
    .select("id")
    .single();
  if (acceptanceError || !acceptance) {
    throw new Error(`plan change acceptance insert failed: ${acceptanceError?.message}`);
  }

  await billingProvider.updateSubscription(subscription.id, {
    priceId: toPlanVersion.stripe_price_id,
  });

  await db
    .from("platform_subscriptions")
    .update({
      plan_version_id: input.toPlanVersionId,
      plan_key: toPlanVersion.plans?.key ?? "unknown",
    })
    .eq("id", subscription.id);

  return {
    planChangeAcceptanceId: acceptance.id,
    fromPlanVersionId: subscription.plan_version_id,
    toPlanVersionId: input.toPlanVersionId,
    direction,
  };
}
