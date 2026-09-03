import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { settleAssetOwnersForPaidInvoice } from "@/lib/asset-owner-settlement";
import type { InvoiceDetail } from "@/types/domain";

export const dynamic = "force-dynamic";

const SELECT =
  "id, billing_account_id, status, previous_status, total_amount, total_currency, due_date, paid_at, created_at, billing_accounts(id, cycle, organizations(id, name))";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const supabase = scope.db;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(SELECT)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (error) return internalError(error);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { data: lineItems, error: itemsError } = await supabase
    .from("invoice_line_items")
    .select("id, description, quantity, unit_price_amount, unit_price_currency, sort_order")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });
  if (itemsError) return internalError(itemsError);

  const detail: InvoiceDetail = {
    ...(invoice as unknown as InvoiceDetail),
    invoice_line_items: lineItems ?? [],
  };
  return NextResponse.json({ data: detail });
}

// Manual transitions — for payments settled outside Asaas (bank transfer,
// boleto, etc). The Asaas webhook drives issued/overdue -> paid separately
// when a checkout session actually completes.
const MANUAL_TRANSITIONS: Record<string, string[]> = {
  draft: ["issued", "cancelled"],
  issued: ["paid", "overdue", "cancelled"],
  overdue: ["paid", "cancelled"],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const supabase = scope.db;

  const body = (await req.json()) as { status?: string; undo?: boolean };

  const { data: current, error: fetchError } = await supabase
    .from("invoices")
    .select("status, previous_status, contract_id, total_amount, total_currency")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Reverts the last manual transition (e.g. a mistaken click on "Vencida"
  // or "Cancelada") back to whatever status the invoice was in right
  // before it — single level, not a full history stack.
  if (body.undo) {
    if (!current.previous_status) {
      return NextResponse.json({ error: "Nothing to undo" }, { status: 422 });
    }
    const undoUpdate: Record<string, unknown> = {
      status: current.previous_status,
      previous_status: null,
      updated_at: new Date().toISOString(),
    };
    if (current.status === "paid") undoUpdate.paid_at = null;

    const { error: undoError } = await supabase
      .from("invoices")
      .update(undoUpdate)
      .eq("id", id)
      .eq("tenant_id", scope.tenantId);
    if (undoError) return internalError(undoError);

    return NextResponse.json({ data: { ok: true } });
  }

  if (!body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const allowed = MANUAL_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `cannot transition from ${current.status} to ${body.status}` },
      { status: 422 },
    );
  }

  const update: Record<string, unknown> = {
    status: body.status,
    previous_status: current.status,
    updated_at: new Date().toISOString(),
  };
  if (body.status === "paid") update.paid_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("invoices")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  if (body.status === "paid" && current.contract_id) {
    void settleAssetOwnersForPaidInvoice(supabase, {
      tenantId: scope.tenantId,
      invoiceId: id,
      contractId: current.contract_id,
      totalAmount: Number(current.total_amount),
      currency: current.total_currency,
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
