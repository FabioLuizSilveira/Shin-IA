import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT = "id, quantity, notes, created_at, assets(id, name, category, status)";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("contract_assets")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .eq("contract_id", id)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { asset_id?: string; quantity?: number; notes?: string };
  if (!body.asset_id) {
    return NextResponse.json({ error: "asset_id is required" }, { status: 422 });
  }

  const { data: contract, error: contractError } = await scope.db
    .from("contracts")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (contractError) return internalError(contractError);
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const { data: created, error: insertError } = await scope.db
    .from("contract_assets")
    .insert({
      tenant_id: scope.tenantId,
      contract_id: id,
      asset_id: body.asset_id,
      quantity: body.quantity ?? 1,
      notes: body.notes,
    })
    .select(SELECT)
    .single();
  if (insertError) return internalError(insertError);

  return NextResponse.json({ data: created }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const linkId = req.nextUrl.searchParams.get("linkId");
  if (!linkId) {
    return NextResponse.json({ error: "linkId query param is required" }, { status: 422 });
  }

  const { error } = await scope.db
    .from("contract_assets")
    .delete()
    .eq("id", linkId)
    .eq("tenant_id", scope.tenantId)
    .eq("contract_id", id);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
