import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "./types.js";

// Derives entitlements live from the tenant's active subscription's
// plan_version — no persisted entitlements/product_access table, so there's
// nothing to fall out of sync (item 17/18). Features never have their own
// acceptance: whatever is in included_features is available the moment the
// subscription is active/trialing, full stop.
export async function getEntitlements(
  db: SupabaseClient,
  input: { tenantId: string; product: Product },
): Promise<{ active: boolean; features: string[]; planKey: string | null }> {
  const { data, error } = await db
    .from("platform_subscriptions")
    .select("status, plan_key, plan_versions(included_features)")
    .eq("tenant_id", input.tenantId)
    .eq("product", input.product)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`entitlements lookup failed: ${error.message}`);
  if (!data) return { active: false, features: [], planKey: null };

  const active = data.status === "active" || data.status === "trialing";
  const planVersions = data.plan_versions as unknown as { included_features: string[] } | null;

  return {
    active,
    features: active ? (planVersions?.included_features ?? []) : [],
    planKey: data.plan_key,
  };
}
