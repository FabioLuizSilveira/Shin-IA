import { NextResponse } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, message, status, review_notes, created_at, reviewed_at, " +
  "contracts(id, organization_id, organizations(name)), rental_customers(id, email, full_name)";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("rental_service_requests")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
