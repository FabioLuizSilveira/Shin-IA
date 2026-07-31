import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, plan_id, name, priority, condition_type, condition_value, rate_override, bonus_amount, is_active";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("commission_rules")
    .select(SELECT)
    .eq("plan_id", id)
    .eq("tenant_id", scope.tenantId)
    .order("priority", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

const VALID_CONDITIONS = [
  "revenue_threshold",
  "operation_count",
  "resource_type",
  "branch",
  "always",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    priority?: number;
    condition_type?: string;
    condition_value?: unknown;
    rate_override?: number;
    bonus_amount?: number;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 422 });
  }
  const conditionType =
    body.condition_type && VALID_CONDITIONS.includes(body.condition_type)
      ? body.condition_type
      : "always";

  const { data: plan } = await scope.db
    .from("commission_plans")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const { data, error } = await scope.db
    .from("commission_rules")
    .insert({
      plan_id: id,
      tenant_id: scope.tenantId,
      name: body.name.trim(),
      priority: body.priority ?? 0,
      condition_type: conditionType,
      condition_value: body.condition_value ?? null,
      rate_override: body.rate_override ?? null,
      bonus_amount: body.bonus_amount ?? null,
    })
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
