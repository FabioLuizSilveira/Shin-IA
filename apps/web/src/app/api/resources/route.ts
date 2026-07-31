import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("resources")
    .select("id, name, type, status, created_at")
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

const VALID_TYPES = ["human", "vehicle", "equipment", "virtual"];

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const tenantId = scope.tenantId;

  const body = (await req.json()) as { name?: string; type?: string };
  if (!body.name?.trim() || !body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "name and type are required" }, { status: 422 });
  }

  const { data: branch, error: branchError } = await scope.db
    .from("branches")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (branchError) return NextResponse.json({ error: branchError.message }, { status: 500 });
  if (!branch) {
    return NextResponse.json(
      { error: "Tenant has no branch to assign this resource to" },
      { status: 422 },
    );
  }

  const { data: created, error: insertError } = await scope.db
    .from("resources")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branch.id,
      name: body.name.trim(),
      type: body.type,
    })
    .select("id, name, type, status, created_at")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ data: created }, { status: 201 });
}
