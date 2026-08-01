import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope, isTenantAdmin } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// M25 gap — no page ever let a tenant configure its own company info.
// GET is open to any authenticated tenant staff member (matches the rest
// of the app); PATCH is gated to tenant_owner/tenant_admin — company-wide
// config (name, currency, support contact) isn't something any staff
// member should be able to change, unlike per-user profile settings.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("tenants")
    .select("id, name, slug, plan, status, default_currency, metadata")
    .eq("id", scope.tenantId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { ...data, can_edit: isTenantAdmin(scope) } });
}

export async function PATCH(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!isTenantAdmin(scope)) {
    return NextResponse.json(
      { error: "Only tenant owners/admins can edit company settings" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    name?: string;
    default_currency?: string;
    metadata?: Record<string, unknown>;
  };

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 422 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.default_currency !== undefined) update.default_currency = body.default_currency;
  if (body.metadata !== undefined) update.metadata = body.metadata;

  const { data, error } = await scope.db
    .from("tenants")
    .update(update)
    .eq("id", scope.tenantId)
    .select("id, name, slug, plan, status, default_currency, metadata")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
