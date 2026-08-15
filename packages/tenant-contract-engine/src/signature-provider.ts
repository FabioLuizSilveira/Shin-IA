import type { AcceptanceEvidence, AcceptanceMethod, RequestContext } from "./types.js";

// Abstraction over how an acceptance is captured (item 11). Only "clickwrap"
// is implemented this round — the others are valid enum values with a real
// plug-in point, not built without a concrete need (spec item 11: "não
// implementar provedor externo sem necessidade").
export interface ContractSignatureProvider {
  method: AcceptanceMethod;
  capture(request: RequestContext): Promise<AcceptanceEvidence>;
}

export const ClickwrapSignatureProvider: ContractSignatureProvider = {
  method: "clickwrap",
  async capture(request: RequestContext): Promise<AcceptanceEvidence> {
    return {
      method: "clickwrap",
      ipAddress: request.ipAddress ?? null,
      userAgent: request.userAgent ?? null,
      sessionId: request.sessionId ?? null,
    };
  },
};

// Staff recording an acceptance on behalf of an operator with no login of
// their own — an administrative acknowledgement, never a real signature.
export const OperatorAcknowledgementProvider: ContractSignatureProvider = {
  method: "operator_acknowledgement",
  async capture(request: RequestContext): Promise<AcceptanceEvidence> {
    return {
      method: "operator_acknowledgement",
      ipAddress: request.ipAddress ?? null,
      userAgent: request.userAgent ?? null,
      sessionId: request.sessionId ?? null,
    };
  },
};

// otp | electronic_signature_provider | digital_signature: not implemented —
// plug a real ContractSignatureProvider here when a concrete product trigger
// requires one.
