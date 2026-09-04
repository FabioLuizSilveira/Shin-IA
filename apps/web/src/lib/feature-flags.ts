import type { TenantScope } from "@/lib/tenant-context";

// Smallest viable feature-flag mechanism — not a generic flag platform.
// Default OFF (opt-in only): a tenant with no row for a flag_key is
// treated as disabled, never as "flags didn't exist yet so allow it".
// Flags are flipped via SQL for pilot tenants in Wave 1 — no admin UI.
export async function isFeatureEnabled(scope: TenantScope, key: string): Promise<boolean> {
  const { data } = await scope.db
    .from("tenant_feature_flags")
    .select("enabled")
    .eq("tenant_id", scope.tenantId)
    .eq("flag_key", key)
    .maybeSingle();
  return data?.enabled ?? false;
}
