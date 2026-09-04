import { NextResponse } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";
import { ensureDefaultAgentWorkspace } from "@/lib/ai/workspace";
import { getCreditBalance } from "@shina/ai-gateway";

export const dynamic = "force-dynamic";

// GET — current Shinã AI credit balance for this tenant's synthetic
// workspace. Read-only, no tenant data beyond the balance itself.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const workspaceId = await ensureDefaultAgentWorkspace(scope.db, scope.tenantId);
  const balance = await getCreditBalance(scope.db, workspaceId);

  return NextResponse.json({ data: { balance, currency: "credits" } });
}
