import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.contract_templates.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await scope.db
    .from("tenant_contract_templates")
    .select("id, tenant_id, key, party_type, name, status")
    .or(`tenant_id.is.null,tenant_id.eq.${scope.tenantId}`)
    .order("party_type", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}
