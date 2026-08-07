import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, plan_id, branch_id, period, period_start, period_end, target_revenue, target_operations, achieved_revenue, achieved_operations, status, currency, branches(name), commission_plans(name)";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("commission_targets")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .order("period_start", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

const VALID_PERIODS = ["daily", "weekly", "monthly", "quarterly", "annual"];

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    plan_id?: string;
    branch_id?: string;
    period?: string;
    period_start?: string;
    period_end?: string;
    target_revenue?: number;
    target_operations?: number;
    currency?: string;
  };

  if (
    !body.plan_id ||
    !body.branch_id ||
    !body.period_start ||
    !body.period_end ||
    body.target_revenue === undefined
  ) {
    return NextResponse.json(
      { error: "plan_id, branch_id, period_start, period_end and target_revenue are required" },
      { status: 422 },
    );
  }
  const period = body.period && VALID_PERIODS.includes(body.period) ? body.period : "monthly";

  const { data, error } = await scope.db
    .from("commission_targets")
    .insert({
      tenant_id: scope.tenantId,
      plan_id: body.plan_id,
      branch_id: body.branch_id,
      period,
      period_start: body.period_start,
      period_end: body.period_end,
      target_revenue: body.target_revenue,
      target_operations: body.target_operations ?? null,
      currency: body.currency ?? "BRL",
    })
    .select(SELECT)
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A target already exists for this branch/plan/period" },
        { status: 409 },
      );
    }
    return internalError(error);
  }

  return NextResponse.json({ data }, { status: 201 });
}
