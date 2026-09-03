import type {
  CanonicalSignatureEvent,
  CreateSignatureRequestInput,
  ProviderArtifact,
  ProviderCreateRequestResult,
  ProviderSigningSession,
  SignatureProvider,
  SignatureProviderCapabilities,
  SignatureProviderType,
  SignatureStatus,
} from "../types.js";

interface FakeRequestRecord {
  providerRequestId: string;
  status: SignatureStatus;
  signers: { externalId: string; name: string; email: string }[];
}

// In-memory, fully-functional implementation of every SignatureProvider
// method — not a partial stub. Two independent instances (constructed
// with different `providerType` strings) let the substitutability test
// (spec section 44) exercise a real provider swap without a Clicksign
// sandbox account. State lives in a Map, scoped to one instance — a fresh
// `new FakeSignatureProvider(...)` per test/process, never shared globally.
export class FakeSignatureProvider implements SignatureProvider {
  readonly capabilities: SignatureProviderCapabilities = {
    supportsSigningOrder: false,
    supportsExpiration: false,
    supportsBulkSigners: true,
  };

  private readonly requests = new Map<string, FakeRequestRecord>();
  private nextId = 1;

  constructor(readonly type: SignatureProviderType) {}

  async createRequest(input: CreateSignatureRequestInput): Promise<ProviderCreateRequestResult> {
    const providerRequestId = `${this.type}_req_${this.nextId++}`;
    const signers = input.signers.map((s, idx) => ({
      externalId: `${providerRequestId}_signer_${idx}`,
      name: s.name,
      email: s.email,
    }));
    this.requests.set(providerRequestId, { providerRequestId, status: "sent", signers });
    return {
      providerRequestId,
      signers: signers.map((s) => ({
        ...s,
        signingUrl: `https://fake.local/sign/${s.externalId}`,
      })),
    };
  }

  async getRequest(providerRequestId: string): Promise<{ status: SignatureStatus } | null> {
    const record = this.requests.get(providerRequestId);
    return record ? { status: record.status } : null;
  }

  async getSigningSession(
    providerRequestId: string,
    signerExternalId: string,
  ): Promise<ProviderSigningSession> {
    const record = this.requests.get(providerRequestId);
    if (!record) throw new Error(`fake provider: unknown request ${providerRequestId}`);
    const signer = record.signers.find((s) => s.externalId === signerExternalId);
    if (!signer) throw new Error(`fake provider: unknown signer ${signerExternalId}`);
    return { signingUrl: `https://fake.local/sign/${signerExternalId}`, expiresAt: null };
  }

  async cancelRequest(providerRequestId: string): Promise<void> {
    const record = this.requests.get(providerRequestId);
    if (!record) throw new Error(`fake provider: unknown request ${providerRequestId}`);
    record.status = "cancelled";
  }

  async getSignedArtifacts(providerRequestId: string): Promise<ProviderArtifact[]> {
    const record = this.requests.get(providerRequestId);
    if (!record) throw new Error(`fake provider: unknown request ${providerRequestId}`);
    const content = new TextEncoder().encode(`fake signed document for ${providerRequestId}`);
    return [
      {
        kind: "signed",
        filename: `${providerRequestId}-signed.pdf`,
        contentType: "application/pdf",
        content,
        hash: `fakehash_${providerRequestId}`,
      },
    ];
  }

  // Accepts a fake-but-real JSON payload shaped like { type, requestId,
  // signerExternalId? } — exercised by the substitutability test as an
  // actual webhook body, not bypassed. A real adapter's normalizeWebhook
  // would additionally verify a signature/token here (spec section 24);
  // the fake provider has no such secret to check.
  async normalizeWebhook(rawPayload: unknown): Promise<CanonicalSignatureEvent[]> {
    const payload = rawPayload as {
      type?: string;
      eventId?: string;
      requestId?: string;
      signerExternalId?: string;
    };
    if (!payload.type || !payload.requestId) {
      throw new Error("fake provider: malformed webhook payload");
    }
    const record = this.requests.get(payload.requestId);
    if (!record) throw new Error(`fake provider: unknown request ${payload.requestId}`);

    const eventId = payload.eventId ?? `${payload.requestId}_${payload.type}_${Date.now()}`;
    const base = {
      provider: this.type,
      providerEventId: eventId,
      providerRequestId: payload.requestId,
      rawPayload: payload as Record<string, unknown>,
    };

    switch (payload.type) {
      case "signer_signed":
        record.status = "in_progress";
        return [
          {
            ...base,
            eventType: "signer_signed",
            kind: "signer_signed",
            signerExternalId: payload.signerExternalId ?? null,
          },
        ];
      case "signature_completed":
        record.status = "signed";
        return [{ ...base, eventType: "signature_completed", kind: "signature_completed" }];
      case "signature_cancelled":
        record.status = "cancelled";
        return [{ ...base, eventType: "signature_cancelled", kind: "signature_cancelled" }];
      default:
        throw new Error(`fake provider: unknown webhook type ${payload.type}`);
    }
  }
}
