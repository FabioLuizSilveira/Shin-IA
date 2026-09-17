import type { SupabaseClient } from "@supabase/supabase-js";
import type { MaintenanceOrderType } from "@shina/maintenance-engine";

// Agent Runtime v3, Wave 4 ("Multi-Domain") — extracted from
// POST /api/maintenance's inline insert logic (the only real caller
// before this) so the Agent's create_maintenance_request tool and the
// HTTP route call the exact same function instead of two copies of the
// same business rules. Every cost field defaults to 0; total_cost_cents
// stays a DB generated column (labor+parts+other), never computed here.

export interface CreateMaintenanceOrderInput {
  tenantId: string;
  createdBy: string;
  assetId: string;
  type: MaintenanceOrderType;
  description: string;
  contractId?: string | null;
  customerId?: string | null;
  operatorId?: string | null;
  supplierId?: string | null;
  branchId?: string | null;
  scheduledAt?: string | null;
  odometer?: number | null;
  hourMeter?: number | null;
  laborCostCents?: number | null;
  partsCostCents?: number | null;
  otherCostCents?: number | null;
  sourceType?: string | null;
  sourceId?: string | null;
  initialStatus?: "scheduled" | "in_progress";
}

export interface MaintenanceOrder {
  id: string;
  assetId: string;
  type: MaintenanceOrderType;
  status: string;
}

export class AssetNotFoundError extends Error {
  constructor() {
    super("asset not found for this tenant");
  }
}

export async function createMaintenanceOrder(
  db: SupabaseClient,
  input: CreateMaintenanceOrderInput,
): Promise<MaintenanceOrder> {
  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("id")
    .eq("id", input.assetId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new AssetNotFoundError();

  const id = crypto.randomUUID();
  const status = input.initialStatus ?? "scheduled";
  const { error: insertError } = await db.from("maintenance_orders").insert({
    id,
    tenant_id: input.tenantId,
    asset_id: input.assetId,
    contract_id: input.contractId ?? null,
    customer_id: input.customerId ?? null,
    operator_id: input.operatorId ?? null,
    supplier_id: input.supplierId ?? null,
    branch_id: input.branchId ?? null,
    type: input.type,
    status,
    scheduled_at: input.scheduledAt ?? null,
    started_at: status === "in_progress" ? new Date().toISOString() : null,
    odometer: input.odometer ?? null,
    hour_meter: input.hourMeter ?? null,
    description: input.description,
    labor_cost_cents: input.laborCostCents ?? 0,
    parts_cost_cents: input.partsCostCents ?? 0,
    other_cost_cents: input.otherCostCents ?? 0,
    source_type: input.sourceType ?? null,
    source_id: input.sourceId ?? null,
    created_by: input.createdBy,
  });
  if (insertError) throw insertError;

  return { id, assetId: input.assetId, type: input.type, status };
}
