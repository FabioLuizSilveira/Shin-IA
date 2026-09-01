import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// GET /api/maintenance/insights (Etapa 14) — list, most recent first.
// Optional ?status= filter (defaults to "open" so the common case -- "what
// needs attention right now" -- doesn't require the caller to know the
// enum). Reuses tenant.maintenance.view.
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "open";
  let query = scope.db.from("maintenance_insights").select("*").eq("tenant_id", scope.tenantId);
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}
