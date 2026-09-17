import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import type { InspectionPurpose, InspectionType } from "@shina/inspection-engine";
import {
  createInspection,
  AssetNotFoundError,
  NoBlueprintError,
  InspectionTemplateResolutionError,
} from "@/lib/inspections/inspection-service";

export const dynamic = "force-dynamic";

const SELECT =
  "id, asset_id, contract_id, operation_id, customer_id, operator_id, responsible_user_id, template_id, type, status, linked_inspection_id, started_at, completed_at, created_at";

export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const status = req.nextUrl.searchParams.get("status");
  const assetId = req.nextUrl.searchParams.get("assetId");

  let query = scope.db.from("inspections").select(SELECT).eq("tenant_id", scope.tenantId);
  if (status) query = query.eq("status", status);
  if (assetId) query = query.eq("asset_id", assetId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface CreateInspectionBody {
  assetId?: string;
  type?: InspectionType;
  purpose?: InspectionPurpose;
  contractId?: string;
  operationId?: string;
  customerId?: string;
  operatorId?: string;
  blueprintId?: string;
  linkedInspectionId?: string;
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as CreateInspectionBody;
  if (!body.assetId || !body.type || !body.purpose) {
    return NextResponse.json({ error: "assetId, type and purpose are required" }, { status: 400 });
  }

  let inspection;
  try {
    inspection = await createInspection(scope.db, {
      tenantId: scope.tenantId,
      responsibleUserId: scope.userId,
      assetId: body.assetId,
      type: body.type,
      purpose: body.purpose,
      contractId: body.contractId,
      operationId: body.operationId,
      customerId: body.customerId,
      operatorId: body.operatorId,
      blueprintId: body.blueprintId,
      linkedInspectionId: body.linkedInspectionId,
    });
  } catch (err) {
    if (err instanceof AssetNotFoundError) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (err instanceof NoBlueprintError) {
      return NextResponse.json(
        {
          error: "asset_has_no_blueprint",
          message: "Ativo não tem blueprint associado — informe blueprintId.",
        },
        { status: 422 },
      );
    }
    if (err instanceof InspectionTemplateResolutionError) {
      return NextResponse.json(
        { error: "no_inspection_template_mapped", message: err.message },
        { status: 422 },
      );
    }
    return internalError(err);
  }

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection",
    entityId: inspection.id,
    action: "created",
    metadata: { assetId: body.assetId, type: body.type, templateId: inspection.templateId },
  });

  return NextResponse.json(
    { data: { id: inspection.id, templateId: inspection.templateId, status: "draft" } },
    { status: 201 },
  );
}
