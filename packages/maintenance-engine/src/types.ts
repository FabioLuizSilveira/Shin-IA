// Maintenance module (P0) — docs/modules/MAINTENANCE.md. Pure domain
// types, no SupabaseClient/framework dependency, same house shape as
// inspection-engine/infractions-engine/crm-engine.

export type MaintenanceOrderType =
  | "preventive"
  | "corrective"
  | "predictive"
  | "inspection_generated"
  | "emergency";

export type MaintenanceOrderStatus =
  | "scheduled"
  | "awaiting_approval"
  | "approved"
  | "in_progress"
  | "completed"
  | "cancelled";

export type MaintenancePlanTriggerType =
  | "date"
  | "odometer"
  | "hour_meter"
  | "condition"
  | "combined";

export interface MaintenanceOrder {
  id: string;
  tenantId: string;
  assetId: string;
  contractId: string | null;
  customerId: string | null;
  operatorId: string | null;
  supplierId: string | null;
  branchId: string | null;
  type: MaintenanceOrderType;
  status: MaintenanceOrderStatus;
  openedAt: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  odometer: number | null;
  hourMeter: number | null;
  description: string;
  diagnosis: string | null;
  cause: string | null;
  resolution: string | null;
  laborCostCents: number;
  partsCostCents: number;
  otherCostCents: number;
  totalCostCents: number;
  downtimeStart: string | null;
  downtimeEnd: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdBy: string;
  approvedBy: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceItem {
  id: string;
  maintenanceOrderId: string;
  component: string;
  serviceType: string;
  description: string;
  partNumber: string | null;
  quantity: number | null;
  unitCostCents: number | null;
  laborCostCents: number | null;
  warrantyUntil: string | null;
  warrantyKm: number | null;
  warrantyHours: number | null;
}

export interface MaintenancePlan {
  id: string;
  tenantId: string;
  assetId: string | null;
  assetTypeId: string | null;
  name: string;
  triggerType: MaintenancePlanTriggerType;
  intervalDays: number | null;
  intervalOdometer: number | null;
  intervalHourMeter: number | null;
  conditionNotes: string | null;
  lastTriggeredAt: string | null;
  lastTriggeredOdometer: number | null;
  lastTriggeredHourMeter: number | null;
  active: boolean;
}

// ── Preventive due resolution (Etapa 3) ─────────────────────────────────
export type DueReasonKind = "date" | "odometer" | "hour_meter";

export interface DueEstimate {
  kind: DueReasonKind;
  dueAt?: string; // for kind "date"
  dueAtValue?: number; // for kind "odometer"/"hour_meter"
  remaining?: number; // remaining km/hours, only meaningful for those kinds
}

export interface PlanDueResult {
  isDue: boolean;
  // "Whichever comes first" (item 3 do spec) — every applicable trigger
  // this plan declares, sorted so the caller can see what's closest, not
  // just a single collapsed answer.
  estimates: DueEstimate[];
  nearest: DueEstimate | null;
}
