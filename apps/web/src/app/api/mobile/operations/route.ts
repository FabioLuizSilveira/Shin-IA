import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { resolveOperationsVisibility } from "@/lib/mobile-operations-scope";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, status, scheduled_starts_at, scheduled_ends_at, started_at, completed_at, description, " +
  "resources(id, name, type, status), assets(id, name, category, status)";

// Wave 2 Phase B — the existing /api/operations has no filters and is
// hard-gated to requireTenantScope() (tenant staff only); customer/operator
// identities have no tenant_id claim and would get a 403 from it
// structurally. This is the real justification for a separate mobile
// route (not aesthetics): different auth path entirely for 2 of the 4
// userTypes, plus filters the mobile list view actually needs. Filters
// only ever map to real columns/relationships that already exist — no
// invented filter.
export async function GET(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType === "unprovisioned") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const assetId = params.get("assetId");
  const branchId = params.get("branchId");
  const operatorId = params.get("operatorId");
  const organizationId = params.get("organizationId");

  let query = context.db.from("operations").select(SELECT).is("deleted_at", null);

  if (context.userType === "tenant_user") {
    query = query.eq("tenant_id", context.tenantId);
    if (branchId) query = query.eq("branch_id", branchId);

    if (operatorId) {
      const { data: assignments } = await context.db
        .from("operator_assignments")
        .select("operation_id")
        .eq("tenant_id", context.tenantId)
        .eq("operator_id", operatorId)
        .not("operation_id", "is", null);
      const ids = (assignments ?? []).map((a) => a.operation_id as string);
      query = query.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }

    if (organizationId) {
      const { data: contracts } = await context.db
        .from("contracts")
        .select("id")
        .eq("tenant_id", context.tenantId)
        .eq("organization_id", organizationId);
      const contractIds = (contracts ?? []).map((c) => c.id);
      const { data: requirements } =
        contractIds.length > 0
          ? await context.db
              .from("tenant_contract_requirements")
              .select("operation_id")
              .in("contract_id", contractIds)
              .not("operation_id", "is", null)
          : { data: [] as { operation_id: string }[] };
      const ids = (requirements ?? []).map((r) => r.operation_id as string);
      query = query.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
  } else {
    // customer / operator
    const visibility = await resolveOperationsVisibility(context);
    const ids = visibility?.kind === "ids" ? visibility.operationIds : [];
    if (ids.length === 0) {
      return NextResponse.json({ data: [] });
    }
    query = query.in("id", ids);
  }

  if (status) query = query.eq("status", status);
  if (dateFrom) query = query.gte("scheduled_starts_at", dateFrom);
  if (dateTo) query = query.lte("scheduled_starts_at", dateTo);
  if (assetId) query = query.eq("asset_id", assetId);

  const { data, error } = await query.order("scheduled_starts_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}
