import { NextResponse, type NextRequest } from "next/server";
import {
  CommissionCalculator,
  type CommissionPlan,
  type CommissionRule,
} from "@shina/commission-engine";
import { requireTenantScope, isReadOnlyScope, type TenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, branch_id, plan_id, campaign_id, target_id, operation_id, type, gross_revenue, commission_rate, commission_amount, bonus_amount, total_amount, currency, status, period, period_start, period_end, notes, created_at, branches(name), commission_plans(name)";

export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const status = new URL(req.url).searchParams.get("status");
  let query = scope.db
    .from("commission_transactions")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

const calculator = new CommissionCalculator();

// Mirrors packages/commission-engine's CommissionService#earnCommission, but
// against real tables via direct queries instead of injected repositories —
// this app has no repository-pattern layer anywhere else, so this stays
// consistent with every other tenant-scoped route built this session.
async function updateTargetProgress(
  db: TenantScope["db"],
  branchId: string,
  planId: string,
  periodStart: string,
  revenue: number,
) {
  const { data: target } = await db
    .from("commission_targets")
    .select("id, target_revenue, target_operations, achieved_revenue, achieved_operations, status")
    .eq("branch_id", branchId)
    .eq("plan_id", planId)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (!target || target.status === "achieved") return;

  const newRevenue = Number(target.achieved_revenue) + revenue;
  const newOperations = target.achieved_operations + 1;
  const revenueAchieved = newRevenue >= Number(target.target_revenue);
  const opsAchieved =
    target.target_operations === null || newOperations >= target.target_operations;
  const status =
    revenueAchieved && opsAchieved
      ? "achieved"
      : revenueAchieved || opsAchieved
        ? "partial"
        : "pending";

  await db
    .from("commission_targets")
    .update({
      achieved_revenue: newRevenue,
      achieved_operations: newOperations,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", target.id);
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    branch_id?: string;
    plan_id?: string;
    operation_id?: string;
    gross_revenue?: number;
    operation_count?: number;
    resource_type?: string;
    period_start?: string;
    period_end?: string;
    notes?: string;
  };

  if (
    !body.branch_id ||
    !body.plan_id ||
    body.gross_revenue === undefined ||
    !body.period_start ||
    !body.period_end
  ) {
    return NextResponse.json(
      { error: "branch_id, plan_id, gross_revenue, period_start and period_end are required" },
      { status: 422 },
    );
  }

  const { data: planRow, error: planError } = await scope.db
    .from("commission_plans")
    .select("id, calculation_type, base_rate, tiers, currency, period, status")
    .eq("id", body.plan_id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });
  if (!planRow) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (planRow.status !== "active") {
    return NextResponse.json({ error: "Commission plan is not active" }, { status: 422 });
  }

  const { data: ruleRows, error: rulesError } = await scope.db
    .from("commission_rules")
    .select("id, priority, condition_type, condition_value, rate_override, bonus_amount, is_active")
    .eq("plan_id", body.plan_id)
    .eq("is_active", true);
  if (rulesError) return NextResponse.json({ error: rulesError.message }, { status: 500 });

  const plan: CommissionPlan = {
    id: planRow.id,
    tenantId: scope.tenantId,
    name: "",
    description: "",
    calculationType: planRow.calculation_type,
    baseRate: Number(planRow.base_rate),
    tiers: planRow.tiers,
    currency: planRow.currency,
    period: planRow.period,
    status: planRow.status,
    effectiveFrom: "",
    effectiveUntil: null,
    createdAt: "",
    updatedAt: "",
  };
  const rules: CommissionRule[] = (ruleRows ?? []).map((r) => ({
    id: r.id,
    planId: body.plan_id!,
    tenantId: scope.tenantId,
    name: "",
    priority: r.priority,
    conditionType: r.condition_type,
    conditionValue: r.condition_value,
    rateOverride: r.rate_override === null ? null : Number(r.rate_override),
    bonusAmount: r.bonus_amount === null ? null : Number(r.bonus_amount),
    isActive: r.is_active,
    createdAt: "",
    updatedAt: "",
  }));

  const result = calculator.calculate(plan, rules, {
    branchId: body.branch_id,
    grossRevenue: body.gross_revenue,
    operationCount: body.operation_count ?? 1,
    resourceType: body.resource_type,
    date: new Date().toISOString(),
  });

  // Active campaign bonus (mirrors CommissionService's campaign lookup).
  const today = new Date().toISOString().slice(0, 10);
  const { data: campaigns } = await scope.db
    .from("commission_campaigns")
    .select("id, plan_id, bonus_rate, max_payout, eligible_branch_ids")
    .eq("tenant_id", scope.tenantId)
    .eq("plan_id", body.plan_id)
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today);

  const eligibleCampaign = (campaigns ?? []).find(
    (c) => c.eligible_branch_ids.length === 0 || c.eligible_branch_ids.includes(body.branch_id),
  );

  let campaignBonus = 0;
  let campaignId: string | null = null;
  if (eligibleCampaign) {
    campaignBonus = result.commissionAmount * Number(eligibleCampaign.bonus_rate);
    if (eligibleCampaign.max_payout !== null) {
      campaignBonus = Math.min(campaignBonus, Number(eligibleCampaign.max_payout));
    }
    campaignId = eligibleCampaign.id;
  }

  const totalBonus = result.bonusAmount + campaignBonus;
  const totalAmount = result.commissionAmount + totalBonus;

  const { data: created, error: insertError } = await scope.db
    .from("commission_transactions")
    .insert({
      tenant_id: scope.tenantId,
      branch_id: body.branch_id,
      plan_id: body.plan_id,
      campaign_id: campaignId,
      operation_id: body.operation_id ?? null,
      type: "earned",
      gross_revenue: body.gross_revenue,
      commission_rate: result.commissionRate,
      commission_amount: result.commissionAmount,
      bonus_amount: totalBonus,
      total_amount: totalAmount,
      currency: result.currency,
      period: planRow.period,
      period_start: body.period_start,
      period_end: body.period_end,
      notes: body.notes?.trim() || null,
    })
    .select(SELECT)
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await updateTargetProgress(
    scope.db,
    body.branch_id,
    body.plan_id,
    body.period_start,
    body.gross_revenue,
  );

  return NextResponse.json({ data: created }, { status: 201 });
}
