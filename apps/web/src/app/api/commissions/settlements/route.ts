import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, branch_id, transaction_ids, total_amount, currency, status, scheduled_at, processed_at, failure_reason, external_reference, created_at, branches(name)";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("commission_settlements")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    branch_id?: string;
    transaction_ids?: string[];
    scheduled_at?: string;
  };
  if (!body.branch_id || !body.transaction_ids?.length || !body.scheduled_at) {
    return NextResponse.json(
      { error: "branch_id, transaction_ids and scheduled_at are required" },
      { status: 422 },
    );
  }

  const { data: eligible, error: fetchError } = await scope.db
    .from("commission_transactions")
    .select("id, total_amount, currency")
    .eq("tenant_id", scope.tenantId)
    .eq("branch_id", body.branch_id)
    .eq("status", "approved")
    .in("id", body.transaction_ids);
  if (fetchError) return internalError(fetchError);

  if (!eligible || eligible.length !== body.transaction_ids.length) {
    return NextResponse.json(
      { error: "Some transactions are not approved or don't belong to this branch" },
      { status: 422 },
    );
  }

  const totalAmount = eligible.reduce((sum, t) => sum + Number(t.total_amount), 0);
  const currency = eligible[0]!.currency;

  const { data, error } = await scope.db
    .from("commission_settlements")
    .insert({
      tenant_id: scope.tenantId,
      branch_id: body.branch_id,
      transaction_ids: body.transaction_ids,
      total_amount: totalAmount,
      currency,
      scheduled_at: body.scheduled_at,
    })
    .select(SELECT)
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data }, { status: 201 });
}
