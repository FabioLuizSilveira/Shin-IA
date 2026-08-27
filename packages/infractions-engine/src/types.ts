// Domain types for the Shinã Infractions Engine. Pure — no Supabase, no
// provider coupling. Mirrors packages/inspection-engine's house style:
// camelCase domain types, repository interfaces injected by the caller.

export type InfractionSource =
  | "manual"
  | "csv_import"
  | "senatran"
  | "renainf"
  | "serpro"
  | "detran"
  | "authority"
  | "partner";

export type InfractionMatchConfidence = "exact_renavam" | "exact_plate" | "ambiguous" | "not_found";

export type InfractionCaseStatus =
  | "received"
  | "matching"
  | "matched"
  | "unmatched"
  | "responsibility_pending"
  | "responsibility_suggested"
  | "responsibility_confirmed"
  | "notified"
  | "action_pending"
  | "disputed"
  | "driver_identification_pending"
  | "driver_identified"
  | "defense_pending"
  | "appealed"
  | "payment_pending"
  | "paid"
  | "overdue"
  | "waived"
  | "cancelled"
  | "closed";

export type InfractionResponsiblePartyType = "operator" | "customer" | "tenant" | "unknown";

export type InfractionEvidenceType =
  | "contract"
  | "allocation"
  | "operation"
  | "operator_assignment"
  | "tracking"
  | "document"
  | "customer_statement"
  | "authority_document"
  | "other";

export type InfractionDeadlineType =
  | "driver_identification"
  | "defense"
  | "appeal"
  | "discount"
  | "due"
  | "internal";

export type InfractionDeadlineStatus = "open" | "due_soon" | "overdue" | "completed" | "cancelled";

export type InfractionDisputeStatus =
  | "open"
  | "under_review"
  | "accepted"
  | "rejected"
  | "resolved";

export type InfractionDriverIdentificationStatus =
  | "not_required"
  | "pending"
  | "ready"
  | "submitted"
  | "accepted"
  | "rejected"
  | "expired";

export type InfractionDefenseKind = "defense" | "appeal";
export type InfractionDefenseStatus =
  | "draft"
  | "submitted"
  | "under_analysis"
  | "accepted"
  | "rejected"
  | "expired";

export type InfractionPaymentKind = "to_authority" | "reimbursement_from_responsible";

// ── External-provider-facing shape (item 6/7 of the spec) ──────────────────
// What any InfractionProvider hands back, before persistence — the
// normalized representation, not a specific vendor's payload shape.
export interface ExternalInfraction {
  source: InfractionSource;
  externalId: string | null;
  autoNumber: string | null;
  authorityCode: string | null;
  authorityName: string | null;
  infractionCode: string | null;
  description: string | null;
  plate: string;
  renavam: string | null;
  occurredAt: string; // ISO timestamp
  location: string | null;
  municipality: string | null;
  state: string | null;
  amountCents: number | null;
  amountCurrency: string;
  dueDate: string | null;
  driverIdentificationDeadline: string | null;
  defenseDeadline: string | null;
  paymentDeadline: string | null;
  discountDeadline: string | null;
  externalStatus: string | null;
  rawPayload: Record<string, unknown>;
}

export interface InfractionProviderCapabilities {
  supportsPull: boolean;
  supportsPush: boolean;
  supportsDriverIdentification: boolean;
  supportsPaymentStatus: boolean;
  supportsAppealSubmission: boolean;
}

// item 6 — abstraction every provider (manual, CSV, future official
// integrations) implements identically. The domain never imports a
// specific vendor.
export interface InfractionProvider {
  readonly source: InfractionSource;
  readonly capabilities: InfractionProviderCapabilities;
  fetchInfractions(input: unknown): Promise<ExternalInfraction[]>;
}

// ── Dedup ────────────────────────────────────────────────────────────────
export interface DedupKey {
  kind: "external_id" | "fallback";
  source: InfractionSource;
  externalId?: string;
  autoNumber?: string;
  plate?: string;
  occurredAt?: string;
  authorityCode?: string;
}

// ── Matching (item 9) ────────────────────────────────────────────────────
export interface AssetMatchCandidate {
  assetId: string;
  tenantId: string;
  plate: string | null;
  renavam: string | null;
}

export interface AssetMatchResult {
  confidence: InfractionMatchConfidence;
  assetId: string | null;
  tenantId: string | null;
  candidateCount: number;
}

// ── Responsibility resolution (item 11) ─────────────────────────────────
export interface ResponsibilityInput {
  occurredAt: string;
  contract: {
    id: string;
    organizationId: string;
    periodStartsAt: string;
    periodEndsAt: string;
  } | null;
  customerId: string | null; // already resolved by the caller via organization_id -> rental_customer_organizations
  operation: { id: string; startsAt: string; endsAt: string } | null;
  allocation: { id: string; startsAt: string; endsAt: string } | null;
  operatorAssignment: { operatorId: string; status: string } | null;
  trackingConfirmed: boolean;
}

export interface ResponsibilitySuggestion {
  responsibleType: InfractionResponsiblePartyType;
  responsibleId: string | null;
  confidence: number;
  reasons: string[];
}

// ── Deadline calculation (item 17) ──────────────────────────────────────
export interface DeadlineInput {
  deadlineType: InfractionDeadlineType;
  dueAt: string | null; // when the provider/document already gives one
  baseDate?: string; // when calculated instead
  daysFromBase?: number;
  ruleVersion?: string;
}

export interface ResolvedDeadline {
  dueAt: string;
  source: "provider" | "calculated";
  ruleVersion: string | null;
  baseDate: string | null;
}
