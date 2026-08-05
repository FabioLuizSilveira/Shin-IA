import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope, isTenantAdmin } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!isTenantAdmin(scope)) {
    return NextResponse.json(
      { error: "Only tenant owners/admins can manage commission rules" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as { is_active?: boolean };
  if (typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active (boolean) is required" }, { status: 422 });
  }

  const { error } = await scope.db
    .from("commission_rules")
    .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!isTenantAdmin(scope)) {
    return NextResponse.json(
      { error: "Only tenant owners/admins can manage commission rules" },
      { status: 403 },
    );
  }

  const { error } = await scope.db
    .from("commission_rules")
    .delete()
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { ok: true } });
}
