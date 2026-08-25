// Domain types for the Inspection Engine — mirrors the schema in
// supabase/migrations/20260098000000_inspection_engine.sql exactly.
// Pure types only, no Supabase/DB import here (same separation as
// packages/tracking-engine and packages/tenant-contract-engine).

export type InspectionType =
  | "pre_delivery"
  | "check_in"
  | "check_out"
  | "return"
  | "periodic"
  | "maintenance"
  | "damage"
  | "custom";

export type InspectionStatus =
  | "draft"
  | "in_progress"
  | "pending_review"
  | "completed"
  | "rejected"
  | "abandoned";

export type InspectionTemplateStatus = "draft" | "published" | "archived";

export type InspectionFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "single_select"
  | "multi_select"
  | "condition"
  | "odometer"
  | "hour_meter"
  | "percentage"
  | "signature"
  | "photo"
  | "multi_photo"
  | "video"
  | "document";

export type InspectionPurpose = "check_in" | "check_out";

export type InspectionMediaType = "photo" | "video" | "document";

export type InspectionFindingSeverity = "low" | "medium" | "high" | "critical";

export type InspectionFindingStatus =
  | "detected"
  | "under_review"
  | "confirmed"
  | "rejected"
  | "chargeable"
  | "waived"
  | "resolved";

export type InspectionSignerType = "customer" | "operator" | "tenant_staff";

export interface SelectOption {
  value: string;
  label: string;
  severity?: InspectionFindingSeverity;
}

// Same {field, op, value} triple already evaluated by
// packages/tenant-contract-engine's evaluateCondition() — reused here via
// the RenderContext-shaped record, not reimplemented.
export interface FieldCondition {
  field: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";
  value: unknown;
}

export interface InspectionTemplate {
  id: string;
  tenantId: string | null;
  key: string;
  name: string;
  assetTypeId: string | null;
  status: InspectionTemplateStatus;
  version: number;
}

export interface InspectionTemplateSection {
  id: string;
  templateId: string;
  key: string;
  title: string;
  instructions: string | null;
  sortOrder: number;
}

export interface InspectionTemplateItem {
  id: string;
  sectionId: string;
  templateId: string;
  key: string;
  label: string;
  fieldType: InspectionFieldType;
  required: boolean;
  instructions: string | null;
  referenceImageUrl: string | null;
  minPhotos: number | null;
  maxPhotos: number | null;
  selectOptions: SelectOption[] | null;
  condition: FieldCondition | null;
  approvalGate: boolean;
  sortOrder: number;
}

// A template with its sections/items hydrated — the shape the runtime
// actually walks to render/validate a checklist.
export interface HydratedInspectionTemplate extends InspectionTemplate {
  sections: (InspectionTemplateSection & { items: InspectionTemplateItem[] })[];
}

export interface BlueprintInspectionMapping {
  id: string;
  blueprintId: string;
  purpose: InspectionPurpose;
  templateId: string;
  isDefault: boolean;
  required: boolean;
  aiDamageDetectionEnabled: boolean;
  aiRequiresHumanApproval: boolean;
}

export interface Inspection {
  id: string;
  tenantId: string;
  branchId: string | null;
  assetId: string;
  assetTypeId: string | null;
  contractId: string | null;
  operationId: string | null;
  customerId: string | null;
  operatorId: string | null;
  responsibleUserId: string;
  templateId: string;
  type: InspectionType;
  status: InspectionStatus;
  linkedInspectionId: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface InspectionResponse {
  id: string;
  tenantId: string;
  inspectionId: string;
  itemId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueJson: SelectOption | SelectOption[] | null;
  notes: string | null;
}

export interface InspectionMedia {
  id: string;
  tenantId: string;
  inspectionId: string;
  itemId: string | null;
  findingId: string | null;
  mediaType: InspectionMediaType;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  capturedAt: string;
  capturedBy: string;
  latitude: number | null;
  longitude: number | null;
  captureSource: string;
  sortOrder: number;
}

export interface InspectionFinding {
  id: string;
  tenantId: string;
  inspectionId: string;
  assetId: string;
  itemId: string | null;
  locationOnAsset: string | null;
  description: string;
  category: string | null;
  severity: InspectionFindingSeverity;
  status: InspectionFindingStatus;
  estimatedCostAmount: number | null;
  estimatedCostCurrency: string | null;
  approvedCostAmount: number | null;
  approvedCostCurrency: string | null;
  responsibleUserId: string | null;
  decisionNotes: string | null;
  aiSuggested: boolean;
  aiConfidence: number | null;
  overlayRegion: OverlayRegion | null;
}

// Normalized coordinates (item 11 of the spec) — 0..1, independent of the
// original image resolution.
export type OverlayRegion =
  | { kind: "box"; x: number; y: number; width: number; height: number }
  | { kind: "polygon"; points: [number, number][] };

export interface InspectionComparison {
  id: string;
  tenantId: string;
  beforeInspectionId: string;
  afterInspectionId: string;
  itemId: string;
  beforeValue: unknown;
  afterValue: unknown;
  differs: boolean;
  aiAnalysis: AiDamageSuggestion | null;
}

// Exact shape requested in item 10 of the spec.
export interface AiDamageSuggestion {
  possibleDamage: boolean;
  confidence: number;
  region: string;
  category: string;
  severity: InspectionFindingSeverity | string;
  description: string;
}

export interface InspectionReport {
  id: string;
  tenantId: string;
  inspectionId: string;
  version: number;
  renderedContent: unknown;
  contentHash: string;
  generatedBy: string;
  generatedAt: string;
}

export interface InspectionSignature {
  id: string;
  tenantId: string;
  inspectionId: string;
  reportId: string;
  signerType: InspectionSignerType;
  customerId: string | null;
  operatorId: string | null;
  userId: string;
  signedAt: string;
  documentHash: string;
  acceptanceMethod: string;
}
