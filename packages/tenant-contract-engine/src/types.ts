export type PartyType = "customer" | "operator";

export type ConsumerRelationship = "consumer" | "business" | "undetermined";

export type DataProcessingLegalBasis =
  | "consent"
  | "contract_performance"
  | "legitimate_interest"
  | "legal_obligation"
  | "not_applicable";

export type AcceptanceMethod =
  | "clickwrap"
  | "otp"
  | "electronic_signature_provider"
  | "digital_signature"
  | "operator_acknowledgement";

export type ConditionOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";

// Declarative clause condition — no bespoke DSL, just a field/op/value triple
// evaluated against the resolution context. See clause-conditions.ts.
export interface ClauseCondition {
  field: string;
  op: ConditionOperator;
  value: unknown;
}

export interface RequirementResolutionInput {
  tenantId: string;
  partyType: PartyType;
  customerId?: string | null;
  operatorId?: string | null;
  blueprintId: string;
  assetTypeId?: string | null;
  operationType?: string | null;
  operatorRequired: boolean;
  operatorIncluded: boolean;
  trackingEnabled: boolean;
  insuranceType?: string | null;
  pricingModel?: string | null;
  jurisdiction?: string | null;
  // Legal configuration — always supplied by the caller (tenant config),
  // never inferred. Defaults applied by the resolver, not guessed here.
  consumerRelationship?: ConsumerRelationship;
  dataProcessingLegalBasis?: DataProcessingLegalBasis;
  operationId?: string | null;
  contractId?: string | null;
}

export interface RequirementResolutionResult {
  requirementId: string;
  templateId: string;
  versionId: string;
  requiredClauseKeys: string[];
  consumerRelationship: ConsumerRelationship;
  dataProcessingLegalBasis: DataProcessingLegalBasis | null;
}

export interface RenderContext {
  operatorIncluded?: boolean;
  operatorRequired?: boolean;
  trackingEnabled?: boolean;
  insuranceIncluded?: boolean;
  insuranceType?: string | null;
  securityDeposit?: number;
  assetCategory?: string | null;
  operatorCertificationRequired?: boolean;
  consumerRelationship?: ConsumerRelationship;
  variables?: Record<string, string | number>;
  [key: string]: unknown;
}

export interface RenderedContract {
  renderedContent: string;
  contentHash: string;
  includedClauseKeys: string[];
}

export interface AcceptanceEvidence {
  method: AcceptanceMethod;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
}

export interface RecordAcceptanceInput {
  tenantId: string;
  partyType: PartyType;
  userId: string;
  customerId?: string | null;
  operatorId?: string | null;
  operationId?: string | null;
  contractId: string;
  contractVersionId: string;
  snapshotId: string;
  documentHash: string;
  acceptanceMethod: AcceptanceMethod;
  consentedDataProcessing?: boolean;
  request: RequestContext;
  metadata?: Record<string, unknown>;
}

export interface OperationGateResult {
  blocked: boolean;
  reasons: string[];
}
