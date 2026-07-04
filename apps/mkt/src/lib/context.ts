import { createClient } from "@/lib/supabase/server";

export interface MktRequestContext {
  userId: string;
  tenantId: string;
  workspaceId: string;
  plan: string;
}

export class MktContextError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Resolves the authenticated user, tenant and workspace for an API request.
 * Creates the workspace on first access (one per tenant, config-driven plan).
 */
export async function getMktContext(): Promise<MktRequestContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new MktContextError("Unauthorized", 401);

  const appMeta = user.app_metadata as { tenant_id?: string };
  const tenantId = appMeta.tenant_id;
  if (!tenantId) throw new MktContextError("No tenant associated with this user", 403);

  const { data: existing } = await supabase
    .from("mkt_workspaces")
    .select("id, plan")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing) {
    return { userId: user.id, tenantId, workspaceId: existing.id, plan: existing.plan };
  }

  const { data: created, error } = await supabase
    .from("mkt_workspaces")
    .insert({
      tenant_id: tenantId,
      name: "Workspace principal",
      slug: `ws-${tenantId.slice(0, 8)}`,
      plan: "free",
    })
    .select("id, plan")
    .single();

  if (error || !created) {
    throw new MktContextError(error?.message ?? "Failed to create workspace", 500);
  }

  return { userId: user.id, tenantId, workspaceId: created.id, plan: created.plan };
}
