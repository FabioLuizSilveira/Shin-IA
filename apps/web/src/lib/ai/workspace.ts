import type { SupabaseClient } from "@supabase/supabase-js";

// The Shinã Agent Platform has no "workspace" concept of its own — only a
// tenant — but the shared @shina/ai-gateway credit ledger/policy tables are
// keyed by workspace_id (apps/mkt can have several workspaces per tenant,
// apps/web never does). Rather than touch that schema, apps/web gets one
// synthetic "default" workspace per tenant, deterministically keyed by the
// tenant's own id (zero extra mapping table needed — the row in
// ai_gateway_workspaces just proves the id/tenant pairing to
// apply_ai_credit_event()'s ownership check).
export async function ensureDefaultAgentWorkspace(
  db: SupabaseClient,
  tenantId: string,
): Promise<string> {
  const { error } = await db
    .from("ai_gateway_workspaces")
    .upsert({ id: tenantId, tenant_id: tenantId, owner_app: "web" }, { onConflict: "id" });
  if (error) throw new Error(`failed to ensure agent workspace: ${error.message}`);
  return tenantId;
}
