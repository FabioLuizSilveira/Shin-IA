import type { AgentTool } from "../tool-types";

const SELECT =
  "id, billing_account_id, status, total_amount, total_currency, due_date, paid_at, created_at, billing_accounts(id, cycle, organizations(id, name))";

export const getInvoicesTool: AgentTool<{ status?: string }> = {
  name: "get_invoices",
  description: "Lista faturas do tenant, opcionalmente filtrando por status.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Status da fatura (ex: issued, overdue, paid)" },
    },
  },
  // Same key GET /api/mobile/billing/summary/route.ts uses for financial
  // data — reused, not a new key invented for this tool.
  requiredPermission: "tenant.dashboard.financial",
  requiredFeature: "agent.tools.billing",
  async execute(args, _ctx, scope) {
    let q = scope.db
      .from("invoices")
      .select(SELECT)
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null);
    if (args.status) q = q.eq("status", args.status);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(25);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },
};

interface InvoiceRow {
  id: string;
  status: string;
  total_amount: number;
  total_currency: string;
  due_date: string;
  paid_at: string | null;
}

// Same buildSummary() logic as GET /api/mobile/billing/summary/route.ts —
// that function isn't exported, so this is its own small copy (same
// rationale as tools/maintenance.ts's toEngineShape) rather than editing
// the live mobile route to export it for a single new caller.
function buildSummary(invoices: InvoiceRow[]) {
  const currency = invoices[0]?.total_currency ?? "BRL";
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const receivable = invoices.filter((i) => i.status === "issued" || i.status === "overdue");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const paidThisMonth = invoices.filter(
    (i) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= monthStart,
  );
  const nextDue = receivable.slice().sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  return {
    receivables: {
      amount: receivable.reduce((sum, i) => sum + Number(i.total_amount), 0),
      currency,
      count: receivable.length,
    },
    overdue: {
      amount: overdue.reduce((sum, i) => sum + Number(i.total_amount), 0),
      currency,
      count: overdue.length,
    },
    paid: {
      amount: paidThisMonth.reduce((sum, i) => sum + Number(i.total_amount), 0),
      currency,
      count: paidThisMonth.length,
    },
    nextDue: nextDue
      ? {
          invoiceId: nextDue.id,
          amount: Number(nextDue.total_amount),
          currency,
          dueDate: nextDue.due_date,
        }
      : null,
  };
}

export const getBillingSummaryTool: AgentTool<Record<string, never>> = {
  name: "get_billing_summary",
  description:
    "Resumo financeiro do tenant: valores a receber, em atraso, pagos no mês e próximo vencimento.",
  inputSchema: { type: "object", properties: {} },
  requiredPermission: "tenant.dashboard.financial",
  requiredFeature: "agent.tools.billing",
  async execute(_args, _ctx, scope) {
    const { data, error } = await scope.db
      .from("invoices")
      .select("id, status, total_amount, total_currency, due_date, paid_at")
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: buildSummary((data ?? []) as InvoiceRow[]) };
  },
};
