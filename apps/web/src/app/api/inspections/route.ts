import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";
import {
  resolveInspectionTemplate,
  InspectionTemplateResolutionError,
  type InspectionPurpose,
  type InspectionType,
} from "@shina/inspection-engine";

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

  const { data: asset, error: assetError } = await scope.db
    .from("assets")
    .select("id, branch_id, asset_type_id")
    .eq("id", body.assetId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (assetError) return internalError(assetError);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  // blueprintId comes from the request only as an override — the normal
  // path resolves it from the asset's own asset_type, same source
  // apply-blueprint-to-asset-types.ts writes to
  // (asset_types.metadata.blueprintId). Never guessed from asset.category
  // or any other heuristic — an asset_type not created from a blueprint
  // has no blueprintId, and that's a 422, not a silent generic template.
  let blueprintId = body.blueprintId ?? null;
  if (!blueprintId && asset.asset_type_id) {
    const { data: assetType, error: assetTypeError } = await scope.db
      .from("asset_types")
      .select("metadata")
      .eq("id", asset.asset_type_id)
      .maybeSingle();
    if (assetTypeError) return internalError(assetTypeError);
    const metadata = assetType?.metadata as { blueprintId?: string } | null;
    blueprintId = metadata?.blueprintId ?? null;
  }
  if (!blueprintId) {
    return NextResponse.json(
      {
        error: "asset_has_no_blueprint",
        message: "Ativo não tem blueprint associado — informe blueprintId.",
      },
      { status: 422 },
    );
  }

  const repo = createInspectionTemplateRepository(scope.db);
  let template;
  try {
    template = await resolveInspectionTemplate(repo, blueprintId, body.purpose);
  } catch (err) {
    if (err instanceof InspectionTemplateResolutionError) {
      return NextResponse.json(
        { error: "no_inspection_template_mapped", message: err.message },
        { status: 422 },
      );
    }
    return internalError(err);
  }

  const id = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("inspections").insert({
    id,
    tenant_id: scope.tenantId,
    branch_id: asset.branch_id,
    asset_id: body.assetId,
    asset_type_id: asset.asset_type_id,
    contract_id: body.contractId ?? null,
    operation_id: body.operationId ?? null,
    customer_id: body.customerId ?? null,
    operator_id: body.operatorId ?? null,
    responsible_user_id: scope.userId,
    template_id: template.id,
    type: body.type,
    status: "draft",
    linked_inspection_id: body.linkedInspectionId ?? null,
  });
  if (insertError) return internalError(insertError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection",
    entityId: id,
    action: "created",
    metadata: { assetId: body.assetId, type: body.type, templateId: template.id },
  });

  return NextResponse.json(
    { data: { id, templateId: template.id, status: "draft" } },
    { status: 201 },
  );
}
