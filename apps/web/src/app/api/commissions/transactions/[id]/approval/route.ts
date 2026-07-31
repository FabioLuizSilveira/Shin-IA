import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// Requests approval for a pending transaction.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const { data: tx } = await scope.db
    .from("commission_transactions")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (tx.status !== "pending") {
    return NextResponse.json({ error: "Transaction is not pending" }, { status: 422 });
  }

  const { data: existing } = await scope.db
    .from("commission_approvals")
    .select("id")
    .eq("transaction_id", id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Approval already requested" }, { status: 409 });
  }

  const { data, error } = await scope.db
    .from("commission_approvals")
    .insert({ tenant_id: scope.tenantId, transaction_id: id, requested_by: scope.userId })
    .select("id, status, requested_by, requested_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}

// Reviews the approval (approve/reject) and updates the transaction status.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { decision?: "approve" | "reject"; notes?: string };
  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ error: "decision must be approve or reject" }, { status: 422 });
  }

  const { data: approval } = await scope.db
    .from("commission_approvals")
    .select("id, status")
    .eq("transaction_id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  if (approval.status !== "pending") {
    return NextResponse.json({ error: "Approval is not pending" }, { status: 422 });
  }

  const now = new Date().toISOString();
  const newStatus = body.decision === "approve" ? "approved" : "rejected";

  const { error: approvalError } = await scope.db
    .from("commission_approvals")
    .update({
      status: newStatus,
      reviewed_by: scope.userId,
      reviewed_at: now,
      decision: body.decision,
      notes: body.notes?.trim() || null,
      updated_at: now,
    })
    .eq("id", approval.id);
  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500 });

  const { error: txError } = await scope.db
    .from("commission_transactions")
    .update({ status: newStatus, updated_at: now })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

  return NextResponse.json({ data: { ok: true, status: newStatus } });
}
