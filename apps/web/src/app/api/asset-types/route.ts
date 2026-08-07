import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
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
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const body = await request.json();
  if (!body.name || !body.category) {
    return NextResponse.json({ error: "name and category are required" }, { status: 400 });
  }

  const { data, error } = await scope.db
    .from("asset_types")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: scope.tenantId,
      name: body.name,
      category: body.category,
      attributes: body.attributes ?? {},
    })
    .select("id, name, category")
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data });
}
