// Shinã Signature Platform — canonical, provider-agnostic electronic
// signature domain. Modeled directly on @shina/billing-platform's
// BillingProvider/createBillingProvider pattern (same shape: a narrow
// provider interface, a resolver keyed off an env var, and a gateway-
// agnostic DB-writing core that only ever reads a Normalized/Canonical
// event, never a raw provider payload).
//
// Hard rule (enforced by keeping this file provider-nomenclature-free):
// nothing in the Contract Engine, Workflow, IAM, or any Shinã domain type
// may ever reference Clicksign-specific (or any other provider's)
// concepts — Envelope, Requirement, Document, status strings, ids, tokens,
// URLs, events, payloads. Everything crosses the boundary through this
// canonical vocabulary. A concrete adapter (e.g. the future Clicksign one)
// owns 100% of the translation in both directions and lives entirely
// under providers/.

// "fake" is deliberately NOT part of the spec's own provider enum (which
// only names real gateways) — it exists purely so the mandatory
// substitutability test (and any future test) can instantiate two
// distinct swappable providers without a real sandbox account. Documented
// here rather than hidden.
// "fake_alt" exists solely so the substitutability test (spec section 44)
// can instantiate two DISTINCT fake providers and prove requests keep
// whichever one created them — never a real second gateway.
export type SignatureProviderType =
  | "fake"
  | "fake_alt"
  | "clicksign"
  | "zapsign"
  | "docusign"
  | "adobe_sign"
  | "custom";

export type SignatureStatus =
  | "draft"
  | "sent"
  | "in_progress"
  | "signed"
  | "cancelled"
  | "expired"
  | "failed";

export type SignerRole =
  | "customer"
  | "operator"
  | "guarantor"
  | "witness"
  | "tenant_representative"
  | "other";

export type SignerStatus = "pending" | "viewed" | "signed" | "refused";

export type SignatureEventKind =
  | "signature_request_sent"
  | "signer_viewed"
  | "signer_signed"
  | "signer_refused"
  | "signature_completed"
  | "signature_cancelled"
  | "signature_expired"
  | "signature_failed";

export type SignatureArtifactKind = "original" | "signed" | "evidence" | "certificate";

// ── Party identity on a signer ──────────────────────────────────────────────
// Only "customer" and "operator" roles carry a party_type today, because
// only those map onto @shina/tenant-contract-engine's PartyType — the one
// bridge back into recordContractAcceptance() once a signature genuinely
// completes. guarantor/witness/tenant_representative/other are real,
// trackable signers with no acceptance-record counterpart yet — a known,
// documented P0/P1 gap, not an oversight.
export type SignerPartyType = "customer" | "operator";

export interface CreateSignatureRequestSigner {
  role: SignerRole;
  name: string;
  email: string;
  /** Required (with the matching id) when role is "customer" or "operator" —
   * needed to bridge back into recordContractAcceptance() at completion. */
  partyType?: SignerPartyType;
  userId?: string | null;
  customerId?: string | null;
  operatorId?: string | null;
}

export interface CreateSignatureRequestInput {
  tenantId: string;
  contractId: string;
  /** Re-derived and cross-checked against the contract row itself before
   * any provider call is made — never trusted verbatim from the caller,
   * same discipline as recordContractAcceptance(). */
  contractVersionId: string;
  snapshotId: string;
  /** The immutable rendered document (PDF bytes) this signature request is
   * for — rendered once, at request-creation time, from the already-frozen
   * tenant_contract_snapshots row (never live/re-rendered data). A file, not
   * semantic text — the provider needs real bytes to upload. */
  documentContent: Uint8Array;
  documentContentType: string;
  documentName: string;
  signers: CreateSignatureRequestSigner[];
}

export interface SignatureRequestRecord {
  id: string;
  tenantId: string;
  contractId: string;
  provider: string;
  providerRequestId: string | null;
  status: SignatureStatus;
}

export interface ProviderSigner {
  externalId: string;
  name: string;
  email: string;
  signingUrl?: string | null;
}

export interface ProviderCreateRequestResult {
  providerRequestId: string;
  signers: ProviderSigner[];
}

export interface ProviderSigningSession {
  signingUrl: string;
  expiresAt: string | null;
}

export interface ProviderArtifact {
  kind: SignatureArtifactKind;
  filename: string;
  contentType: string;
  content: Uint8Array;
  hash: string;
}

// The DB-writing core (signature-service.ts) consumes only this shape,
// never a provider's raw webhook body — every provider's own
// normalizeWebhook() implementation is where provider-specific parsing
// happens, mirroring NormalizedBillingEvent in billing-platform.
export interface CanonicalSignatureEvent {
  provider: string;
  providerEventId: string;
  eventType: string;
  kind: SignatureEventKind;
  providerRequestId: string;
  /** externalId of the signer this event is about, when applicable
   * (signer_viewed/signer_signed/signer_refused). */
  signerExternalId?: string | null;
  rawPayload: Record<string, unknown>;
}

// Declares what a provider is (and is not) capable of — read by the
// service layer to decide behavior, never hardcoded per provider name
// outside the adapter itself.
export interface SignatureProviderCapabilities {
  supportsSigningOrder: boolean;
  supportsExpiration: boolean;
  supportsBulkSigners: boolean;
}

// The provider boundary. A concrete adapter (FakeSignatureProvider today;
// a real Clicksign adapter in P1) is the ONLY place allowed to know
// anything about the underlying gateway's own nomenclature.
export interface SignatureProvider {
  readonly type: SignatureProviderType;
  readonly capabilities: SignatureProviderCapabilities;
  createRequest(input: CreateSignatureRequestInput): Promise<ProviderCreateRequestResult>;
  getRequest(providerRequestId: string): Promise<{ status: SignatureStatus } | null>;
  getSigningSession(
    providerRequestId: string,
    signerExternalId: string,
  ): Promise<ProviderSigningSession>;
  cancelRequest(providerRequestId: string): Promise<void>;
  getSignedArtifacts(providerRequestId: string): Promise<ProviderArtifact[]>;
  /** Verifies + translates a raw provider webhook delivery into zero or
   * more canonical events. Takes the RAW body text (never pre-parsed) plus
   * the request's headers — a P1 correction from P0's original
   * `normalizeWebhook(rawPayload: unknown)`: a real provider (Clicksign)
   * authenticates webhooks via HMAC over the exact raw bytes, which is
   * impossible to verify once the body has already been JSON.parse()'d.
   * The provider parses the body itself, AFTER verifying authenticity —
   * never assumed by the caller. */
  normalizeWebhook(
    rawBody: string,
    headers: Record<string, string | null>,
  ): Promise<CanonicalSignatureEvent[]>;
}

export interface ApplySignatureEventResult {
  duplicate: boolean;
  handled: boolean;
  signatureRequestId?: string;
}
