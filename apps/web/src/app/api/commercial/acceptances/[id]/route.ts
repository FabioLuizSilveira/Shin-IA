import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const { id } = await params;

  const { data, error } = await scope.db
    .from("contract_acceptances")
    .select(
      "id, product, accepted_at, representative_name, representative_role, representative_document, " +
        "declared_authority, document_hash, " +
        "contract_versions(id, title, version, content), " +
        "plan_versions(id, name, price_cents, currency, billing_cycle), " +
        "tenants(name)",
    )
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (error) return internalError(error);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data });
}
