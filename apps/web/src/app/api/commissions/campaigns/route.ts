import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, plan_id, name, description, status, start_date, end_date, bonus_rate, max_payout, eligible_branch_ids, commission_plans(name)";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("commission_campaigns")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .order("start_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    plan_id?: string;
    name?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    bonus_rate?: number;
    max_payout?: number;
    eligible_branch_ids?: string[];
  };

  if (!body.plan_id || !body.name?.trim() || !body.start_date || !body.end_date) {
    return NextResponse.json(
      { error: "plan_id, name, start_date and end_date are required" },
      { status: 422 },
    );
  }
  if (body.start_date > body.end_date) {
    return NextResponse.json({ error: "start_date must be before end_date" }, { status: 422 });
  }

  const { data, error } = await scope.db
    .from("commission_campaigns")
    .insert({
      tenant_id: scope.tenantId,
      plan_id: body.plan_id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      start_date: body.start_date,
      end_date: body.end_date,
      bonus_rate: body.bonus_rate ?? 0,
      max_payout: body.max_payout ?? null,
      eligible_branch_ids: body.eligible_branch_ids ?? [],
    })
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
