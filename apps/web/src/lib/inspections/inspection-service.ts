import type { SupabaseClient } from "@supabase/supabase-js";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";
import {
  resolveInspectionTemplate,
  InspectionTemplateResolutionError,
  type InspectionPurpose,
  type InspectionType,
} from "@shina/inspection-engine";

// Agent Runtime v3, Wave 4 ("Multi-Domain") — extracted from
// POST /api/inspections's inline logic (the only real caller before
// this) so the Agent's create_inspection tool and the HTTP route share
// the exact same blueprint/template resolution instead of two copies.
// blueprintId is resolved from the asset's own asset_type (never
// guessed from category or any other heuristic) unless explicitly
// overridden by the caller — an asset_type not created from a
// blueprint has no blueprintId, which is a real error, not a silent
// generic template.

export interface CreateInspectionInput {
  tenantId: string;
  responsibleUserId: string;
  assetId: string;
  type: InspectionType;
  purpose: InspectionPurpose;
  contractId?: string | null;
  operationId?: string | null;
  customerId?: string | null;
  operatorId?: string | null;
  blueprintId?: string | null;
  linkedInspectionId?: string | null;
}

export interface Inspection {
  id: string;
  templateId: string;
  status: "draft";
}

export class AssetNotFoundError extends Error {
  constructor() {
    super("asset not found for this tenant");
  }
}

export class NoBlueprintError extends Error {
  constructor() {
    super("asset_has_no_blueprint");
  }
}

interface AssetForInspection {
  id: string;
  branch_id: string | null;
  asset_type_id: string | null;
}

/** The read-only half of createInspection() -- resolves the asset and
 * its inspection template WITHOUT inserting anything. Exported so
 * validate() (in the Agent's create-inspection.ts tool) can pre-check
 * the exact same real precondition createInspection() itself enforces,
 * same "never propose a plan that would fail" discipline as
 * rental-service.ts's findApplicableRentalRate check in create-rental.ts. */
export async function resolveInspectionAssetAndTemplate(
  db: SupabaseClient,
  tenantId: string,
  assetId: string,
  purpose: InspectionPurpose,
  blueprintIdOverride?: string | null,
): Promise<{ asset: AssetForInspection; templateId: string }> {
  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("id, branch_id, asset_type_id")
    .eq("id", assetId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new AssetNotFoundError();

  let blueprintId = blueprintIdOverride ?? null;
  if (!blueprintId && asset.asset_type_id) {
    const { data: assetType, error: assetTypeError } = await db
      .from("asset_types")
      .select("metadata")
      .eq("id", asset.asset_type_id)
      .maybeSingle();
    if (assetTypeError) throw assetTypeError;
    const metadata = assetType?.metadata as { blueprintId?: string } | null;
    blueprintId = metadata?.blueprintId ?? null;
  }
  if (!blueprintId) throw new NoBlueprintError();

  const repo = createInspectionTemplateRepository(db);
  // Real resolution errors (no template mapped for this purpose) propagate
  // as InspectionTemplateResolutionError -- callers decide how to surface it.
  const template = await resolveInspectionTemplate(repo, blueprintId, purpose);
  return { asset: asset as AssetForInspection, templateId: template.id as string };
}

export async function createInspection(
  db: SupabaseClient,
  input: CreateInspectionInput,
): Promise<Inspection> {
  const { asset, templateId } = await resolveInspectionAssetAndTemplate(
    db,
    input.tenantId,
    input.assetId,
    input.purpose,
    input.blueprintId,
  );

  const id = crypto.randomUUID();
  const { error: insertError } = await db.from("inspections").insert({
    id,
    tenant_id: input.tenantId,
    branch_id: asset.branch_id,
    asset_id: input.assetId,
    asset_type_id: asset.asset_type_id,
    contract_id: input.contractId ?? null,
    operation_id: input.operationId ?? null,
    customer_id: input.customerId ?? null,
    operator_id: input.operatorId ?? null,
    responsible_user_id: input.responsibleUserId,
    template_id: templateId,
    type: input.type,
    status: "draft",
    linked_inspection_id: input.linkedInspectionId ?? null,
  });
  if (insertError) throw insertError;

  return { id, templateId, status: "draft" };
}

export { InspectionTemplateResolutionError };
