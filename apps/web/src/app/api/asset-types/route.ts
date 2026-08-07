import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, scopedSelect, scopedInsert } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// Obs-21 proof of concept: scopedSelect/scopedInsert apply the tenant_id
// filter/injection inside the helper itself, instead of a `.eq("tenant_id",
// ...)` that has to be remembered at each call site — see tenant-context.ts.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scopedSelect(scope, "asset_types", "id, name, category")
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

  const { data, error } = await scopedInsert(scope, "asset_types", {
    id: crypto.randomUUID(),
    name: body.name,
    category: body.category,
    attributes: body.attributes ?? {},
  })
    .select("id, name, category")
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data });
}
