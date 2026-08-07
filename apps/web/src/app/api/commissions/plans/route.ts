import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, name, description, calculation_type, base_rate, tiers, currency, period, status, effective_from, effective_until, created_at";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("commission_plans")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

const VALID_CALC_TYPES = ["flat", "percentage", "tiered"];
const VALID_PERIODS = ["daily", "weekly", "monthly", "quarterly", "annual"];

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    description?: string;
    calculation_type?: string;
    base_rate?: number;
    tiers?: { minAmount: number; maxAmount: number | null; rate: number }[];
    currency?: string;
    period?: string;
    effective_from?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 422 });
  }
  const calculationType =
    body.calculation_type && VALID_CALC_TYPES.includes(body.calculation_type)
      ? body.calculation_type
      : "percentage";
  const period = body.period && VALID_PERIODS.includes(body.period) ? body.period : "monthly";

  const { data, error } = await scope.db
    .from("commission_plans")
    .insert({
      tenant_id: scope.tenantId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      calculation_type: calculationType,
      base_rate: body.base_rate ?? 0,
      tiers: body.tiers ?? [],
      currency: body.currency ?? "BRL",
      period,
      effective_from: body.effective_from ?? new Date().toISOString().slice(0, 10),
    })
    .select(SELECT)
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data }, { status: 201 });
}
