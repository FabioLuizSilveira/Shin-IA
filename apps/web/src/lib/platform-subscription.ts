import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by both tenant-creation paths (/api/tenants POST and
// /api/onboarding/complete) so every tenant gets a platform_subscriptions
// row from day one — the entitlements resolver never needs a "no row yet"
// fallback branch. tenants.plan/status keep being written as before; this
// row is the gating source of truth going forward.
export async function provisionPlatformSubscription(
  admin: SupabaseClient,
  params: {
    authUserId: string;
    email: string;
    tenantId: string;
    planKey: string;
    status: "trialing" | "active";
  },
): Promise<void> {
  const { data: customer, error: customerError } = await admin
    .from("platform_customers")
    .upsert(
      { auth_user_id: params.authUserId, email: params.email },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();
  if (customerError || !customer) {
    console.error("[platform-subscription] customer upsert failed:", customerError);
    return;
  }

  const { error: subscriptionError } = await admin.from("platform_subscriptions").insert({
    customer_id: customer.id,
    tenant_id: params.tenantId,
    product: "platform",
    plan_key: params.planKey,
    status: params.status,
  });
  if (subscriptionError) {
    // 23505 = the customer already has a live platform subscription (e.g. an
    // existing user being linked to a second tenant) — log, don't fail the
    // whole provisioning flow over it.
    console.error("[platform-subscription] subscription insert failed:", subscriptionError);
  }
}
