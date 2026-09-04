import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";
import { ensureDefaultAgentWorkspace } from "@/lib/ai/workspace";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;

// GET ?limit=&offset= — usage history (technical detail: tokens, cost,
// provider) for this tenant's own workspace only. Uses the admin client
// (requireTenantScope()'s posture everywhere else in this app) so the
// tenant_id filter below is explicit, not just relied on via RLS.
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const workspaceId = await ensureDefaultAgentWorkspace(scope.db, scope.tenantId);
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 25) || 25, MAX_LIMIT);
  const offset = Math.max(Number(req.nextUrl.searchParams.get("offset") ?? 0) || 0, 0);

  const { data, error } = await scope.db
    .from("ai_gateway_usage")
    .select(
      "id, operation, provider, model, tokens_in, tokens_out, credits_consumed, estimated_cost_usd, created_at",
    )
    .eq("tenant_id", scope.tenantId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return internalError(error);

  return NextResponse.json({ data });
}
