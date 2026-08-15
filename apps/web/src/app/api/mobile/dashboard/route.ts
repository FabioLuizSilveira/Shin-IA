import { NextResponse } from "next/server";
import { requireMobileContext, type TenantUserMobileContext } from "@/lib/mobile-context";
import { hasTenantPermission } from "@/lib/tenant-context";
import { resolveOperationsVisibility } from "@/lib/mobile-operations-scope";

export const dynamic = "force-dynamic";

// Wave 2 Phase A — one aggregated call instead of 4-5 round trips, per the
// stated BFF justification (reduces round trips, mobile-specific DTO). No
// business rule is computed here that doesn't already exist elsewhere:
// counts are plain reads, financial figures are read straight from
// `invoices`, recentActivity is the same `tenant_activity_log` table the
// web dashboard already uses.
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  if (context.userType === "unprovisioned") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (context.userType === "tenant_user") {
    const [operationsResult, assetsResult, financial, alerts, recentActivity] = await Promise.all([
      context.db
        .from("operations")
        .select("status", { count: "exact", head: false })
        .eq("tenant_id", context.tenantId)
        .is("deleted_at", null),
      context.db
        .from("assets")
        .select("status", { count: "exact", head: false })
        .eq("tenant_id", context.tenantId)
        .is("deleted_at", null),
      resolveFinancialSummary(context),
      resolveAlerts(context),
      context.db
        .from("tenant_activity_log")
        .select("id, action, entity_type, entity_id, created_at")
        .eq("tenant_id", context.tenantId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const operations = operationsResult.data ?? [];
    const assets = assetsResult.data ?? [];

    return NextResponse.json({
      data: {
        summary: {
          activeOperations: operations.filter((o) => o.status === "in_progress").length,
          pendingOperations: operations.filter((o) => o.status === "pending").length,
          availableAssets: assets.filter((a) => a.status === "available").length,
          assetsInUse: assets.filter((a) => a.status === "in_use").length,
        },
        alerts,
        recentActivity: (recentActivity.data ?? []).map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entity_type,
          entityId: a.entity_id,
          createdAt: a.created_at,
        })),
        financial,
      },
    });
  }

  if (context.userType === "customer") {
    const organizationIds = context.organizations.map((o) => o.organizationId);
    if (organizationIds.length === 0) {
      return NextResponse.json({
        data: {
          summary: {
            activeOperations: 0,
            pendingOperations: 0,
            availableAssets: 0,
            assetsInUse: 0,
          },
          alerts: [],
          recentActivity: [],
          financial: null,
        },
      });
    }

    const { data: contracts } = await context.db
      .from("contracts")
      .select("id, status")
      .in("organization_id", organizationIds);
    const contractIds = (contracts ?? []).map((c) => c.id);

    const visibility = await resolveOperationsVisibility(context);
    const operationIds = visibility?.kind === "ids" ? visibility.operationIds : [];
    const { data: operations } =
      operationIds.length > 0
        ? await context.db.from("operations").select("status").in("id", operationIds)
        : { data: [] as { status: string }[] };

    const { data: pendingDocs } =
      contractIds.length > 0
        ? await context.db
            .from("contract_documents")
            .select("id", { count: "exact", head: true })
            .in("contract_id", contractIds)
            .eq("status", "pending")
        : { data: null };

    return NextResponse.json({
      data: {
        summary: {
          activeOperations: (operations ?? []).filter((o) => o.status === "in_progress").length,
          pendingOperations: (operations ?? []).filter((o) => o.status === "pending").length,
          availableAssets: 0,
          assetsInUse: 0,
        },
        alerts: (contracts ?? [])
          .filter((c) => c.status === "draft")
          .map((c) => ({
            type: "contract_pending_acceptance",
            message: "Você tem um contrato aguardando aceite.",
            severity: "medium",
            resourceId: c.id,
          })),
        recentActivity: [],
        financial: null,
        pendingContracts: (contracts ?? []).filter((c) => c.status === "draft").length,
        pendingDocuments: pendingDocs ?? 0,
      },
    });
  }

  // operator
  const { data: assignments } = await context.db
    .from("operator_assignments")
    .select("status")
    .eq("operator_id", context.operatorId);

  return NextResponse.json({
    data: {
      summary: {
        activeOperations: 0,
        pendingOperations: (assignments ?? []).filter((a) => a.status === "assigned").length,
        availableAssets: 0,
        assetsInUse: 0,
      },
      alerts: [],
      recentActivity: [],
      financial: null,
      assignments: {
        assigned: (assignments ?? []).filter((a) => a.status === "assigned").length,
        confirmed: (assignments ?? []).filter((a) => a.status === "confirmed").length,
      },
    },
  });
}

async function resolveFinancialSummary(context: TenantUserMobileContext) {
  const allowed = await hasTenantPermission(context, "tenant.dashboard.financial");
  if (!allowed) return null;

  const { data: invoices } = await context.db
    .from("invoices")
    .select("status, total_amount, total_currency")
    .eq("tenant_id", context.tenantId)
    .is("deleted_at", null);

  const overdue = (invoices ?? []).filter((i) => i.status === "overdue");
  const pending = (invoices ?? []).filter((i) => i.status === "issued" || i.status === "overdue");
  const currency = invoices?.[0]?.total_currency ?? "BRL";

  return {
    pendingInvoicesTotal: pending.reduce((sum, i) => sum + Number(i.total_amount), 0),
    overdueInvoicesCount: overdue.length,
    currency,
  };
}

async function resolveAlerts(context: TenantUserMobileContext) {
  const { data: blocked } = await context.db
    .from("tenant_activity_log")
    .select("id, entity_id, created_at")
    .eq("tenant_id", context.tenantId)
    .eq("action", "contract.operation_blocked")
    .order("created_at", { ascending: false })
    .limit(5);

  return (blocked ?? []).map((b) => ({
    type: "operation_blocked",
    message: "Uma operação está bloqueada por requisito de contrato pendente.",
    severity: "high",
    resourceId: b.entity_id,
  }));
}
