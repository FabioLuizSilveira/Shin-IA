import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// Marks a settlement processed and pays out its transactions — the manual
// equivalent of a gateway payout confirmation (no real payout rail wired
// up yet, external_reference is operator-entered).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { external_reference?: string };

  const { data: settlement } = await scope.db
    .from("commission_settlements")
    .select("id, status, transaction_ids")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (!settlement) return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
  if (settlement.status !== "pending") {
    return NextResponse.json({ error: "Settlement is not pending" }, { status: 422 });
  }

  const now = new Date().toISOString();

  const { error: settlementError } = await scope.db
    .from("commission_settlements")
    .update({
      status: "completed",
      processed_at: now,
      external_reference: body.external_reference?.trim() || null,
      updated_at: now,
    })
    .eq("id", id);
  if (settlementError) return internalError(settlementError);

  const { error: txError } = await scope.db
    .from("commission_transactions")
    .update({ status: "paid", updated_at: now })
    .in("id", settlement.transaction_ids)
    .eq("tenant_id", scope.tenantId);
  if (txError) return internalError(txError);

  return NextResponse.json({ data: { ok: true } });
}
