import { NextResponse } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("asset_types")
    .select("id, name, category")
    .eq("tenant_id", scope.tenantId)
    .eq("active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
