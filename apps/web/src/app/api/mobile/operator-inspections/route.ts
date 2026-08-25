import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, asset_id, contract_id, operation_id, customer_id, operator_id, template_id, type, status, linked_inspection_id, started_at, completed_at, created_at";

// GET /api/mobile/operator-inspections — the operator's own assigned
// inspection list. Scoped by operator_id = context.operatorId, never by
// tenant_id alone (an operator must never see every inspection in the
// tenant, only what's assigned to them — item 2 of the spec's P0).
export async function GET(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  let query = context.db
    .from("inspections")
    .select(SELECT)
    .eq("tenant_id", context.tenantId)
    .eq("operator_id", context.operatorId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}
