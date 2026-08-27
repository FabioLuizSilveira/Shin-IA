import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { resolveInspectionVisibility } from "@/lib/mobile-inspections-scope";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";
import { logActivity } from "@/lib/activity-log";
import {
  resolveInspectionTemplate,
  InspectionTemplateResolutionError,
  type InspectionPurpose,
  type InspectionType,
} from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

const SELECT =
  "id, asset_id, contract_id, type, status, linked_inspection_id, started_at, completed_at, created_at";

// GET /api/mobile/customer/inspections — the real vínculo is
// customer -> inspection.customer_id (direct FK to rental_customers,
// same table requireMobileContext() already resolved auth.uid() against
// to build customerId) — never a client-supplied customer/contract id.
// A customer never sees an inspection whose customer_id isn't theirs,
// full stop, regardless of what contract/organization it's under.
export async function GET(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const visibility = resolveInspectionVisibility(context);
  if (visibility?.kind !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const contractId = req.nextUrl.searchParams.get("contractId");
  let query = context.db
    .from("inspections")
    .select(SELECT)
    .eq("customer_id", visibility.customerId);
  if (status) query = query.eq("status", status);
  if (contractId) query = query.eq("contract_id", contractId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface CreateSelfServiceInspectionBody {
  contractId?: string;
  type?: InspectionType;
  purpose?: InspectionPurpose;
  assetId?: string;
  linkedInspectionId?: string;
}

// POST /api/mobile/customer/inspections — customer-initiated inspection
// (per-tenant opt-in: tenants.customer_self_inspection_enabled, default
// false — "vistoria continua interna ao tenant" unless a tenant
// explicitly turns this on). Ownership of the contract is proven the
// same way api/mobile/customer/contracts already does — organization_id
// in the customer's own context.organizations, never a client-supplied
// tenant/customer id. Marked metadata.selfService = true, which is what
// the fill routes (items/media/status) require in addition to
// customer_id ownership — a staff-created inspection that merely
// references this customer_id (for tracking/review) is NOT fillable by
// the customer just because the id matches.
export async function POST(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as CreateSelfServiceInspectionBody;
  if (!body.contractId || !body.type || !body.purpose) {
    return NextResponse.json(
      { error: "contractId, type and purpose are required" },
      { status: 400 },
    );
  }

  const orgIds = context.organizations.map((o) => o.organizationId);
  if (orgIds.length === 0) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const { data: contract, error: contractError } = await context.db
    .from("contracts")
    .select("id, tenant_id, organization_id")
    .eq("id", body.contractId)
    .in("organization_id", orgIds)
    .maybeSingle();
  if (contractError) return internalError(contractError);
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const { data: tenant, error: tenantError } = await context.db
    .from("tenants")
    .select("customer_self_inspection_enabled")
    .eq("id", contract.tenant_id)
    .maybeSingle();
  if (tenantError) return internalError(tenantError);
  if (!tenant?.customer_self_inspection_enabled) {
    return NextResponse.json(
      {
        error: "customer_self_inspection_disabled",
        message: "Este tenant não habilitou vistoria feita pelo cliente.",
      },
      { status: 403 },
    );
  }

  const { data: contractAssets, error: assetsError } = await context.db
    .from("contract_assets")
    .select("asset_id")
    .eq("contract_id", contract.id);
  if (assetsError) return internalError(assetsError);
  const linkedAssetIds = new Set((contractAssets ?? []).map((r) => r.asset_id));
  const assetId = body.assetId ?? [...linkedAssetIds][0];
  if (!assetId || !linkedAssetIds.has(assetId)) {
    return NextResponse.json({ error: "assetId must belong to this contract" }, { status: 422 });
  }

  const { data: asset, error: assetError } = await context.db
    .from("assets")
    .select("id, branch_id, asset_type_id")
    .eq("id", assetId)
    .eq("tenant_id", contract.tenant_id)
    .maybeSingle();
  if (assetError) return internalError(assetError);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  let blueprintId: string | null = null;
  if (asset.asset_type_id) {
    const { data: assetType, error: assetTypeError } = await context.db
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
        message: "Ativo não tem blueprint associado.",
      },
      { status: 422 },
    );
  }

  const repo = createInspectionTemplateRepository(context.db);
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
  const { error: insertError } = await context.db.from("inspections").insert({
    id,
    tenant_id: contract.tenant_id,
    branch_id: asset.branch_id,
    asset_id: assetId,
    asset_type_id: asset.asset_type_id,
    contract_id: contract.id,
    customer_id: context.customerId,
    operator_id: null,
    responsible_user_id: context.userId,
    template_id: template.id,
    type: body.type,
    status: "draft",
    linked_inspection_id: body.linkedInspectionId ?? null,
    metadata: { selfService: true },
  });
  if (insertError) return internalError(insertError);

  void logActivity(context.db, {
    tenantId: contract.tenant_id,
    actorId: context.userId,
    entityType: "inspection",
    entityId: id,
    action: "created",
    metadata: { assetId, type: body.type, templateId: template.id, actor: "customer" },
  });

  return NextResponse.json(
    { data: { id, templateId: template.id, status: "draft" } },
    { status: 201 },
  );
}
