import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePlanVersion } from "./contract-requirement.js";
import type { AcceptContractInput } from "./types.js";
import { recordContractAcceptance } from "./acceptance.js";

export type BillingMode = "card" | "invoice" | "manual_contract" | "custom";

export interface ManualActivationInput extends AcceptContractInput {
  billingMode: Exclude<BillingMode, "card">;
  /** Platform admin performing the activation (audit trail, not the tenant's own user). */
  activatedByPlatformUserId: string;
}

// Item 26: Enterprise billing — Proposal -> Contract -> Commercial Terms ->
// Invoice Billing -> Subscription, with no forced card checkout. Only ever
// called from a platform-admin route (never self-serve) — the acceptance
// itself still goes through the same recordContractAcceptance() as the
// card path, so the legal evidence trail is identical either way; what
// differs is that a human at Shinã, not the gateway, confirms the deal exists.
export async function activateSubscriptionManually(
  db: SupabaseClient,
  input: ManualActivationInput,
): Promise<{ subscriptionId: string }> {
  const acceptance = await recordContractAcceptance(db, input);
  const planVersion = await resolvePlanVersion(db, input.planVersionId);

  const { data: customer, error: customerError } = await db
    .from("platform_customers")
    .upsert({ auth_user_id: input.userId }, { onConflict: "auth_user_id" })
    .select("id")
    .single();
  if (customerError || !customer) {
    throw new Error(`customer upsert failed: ${customerError?.message}`);
  }

  // No upsert here on purpose: (customer_id, product) is only unique among
  // non-cancelled rows (a PARTIAL index — see 20260052000000_platform_billing.sql),
  // which a plain onConflict target can't reliably infer against. Same
  // explicit select-then-insert-or-update shape sync-webhook.ts already
  // uses for the exact same table/constraint.
  const status = planVersion.trial_days > 0 ? "trialing" : "active";
  const { data: existing } = await db
    .from("platform_subscriptions")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("product", input.product)
    .neq("status", "cancelled")
    .maybeSingle();

  const row = {
    customer_id: customer.id,
    tenant_id: input.tenantId,
    product: input.product,
    plan_key: planVersion.plans?.key ?? "unknown",
    plan_version_id: input.planVersionId,
    commercial_terms_snapshot_id: acceptance.commercialTermsSnapshotId,
    status,
    billing_mode: input.billingMode,
  };

  const { data: subscription, error: subError } = existing
    ? await db
        .from("platform_subscriptions")
        .update(row)
        .eq("id", existing.id)
        .select("id")
        .single()
    : await db.from("platform_subscriptions").insert(row).select("id").single();
  if (subError || !subscription) throw new Error(`subscription write failed: ${subError?.message}`);

  return { subscriptionId: subscription.id };
}
