import { describe, expect, it } from "vitest";
import { getSignatureEventNotificationCopy } from "./signature-notification-copy";

describe("getSignatureEventNotificationCopy", () => {
  it("notifies on signature_completed with normal priority", () => {
    const copy = getSignatureEventNotificationCopy("signature_completed");
    expect(copy?.logOnly).toBe(false);
    if (copy && !copy.logOnly) {
      expect(copy.subject).toBe("Contrato assinado");
      expect(copy.priority).toBe("normal");
    }
  });

  it("notifies on signer_refused with high priority", () => {
    const copy = getSignatureEventNotificationCopy("signer_refused");
    expect(copy?.logOnly).toBe(false);
    if (copy && !copy.logOnly) expect(copy.priority).toBe("high");
  });

  it("notifies on every terminal non-success outcome", () => {
    for (const kind of ["signature_cancelled", "signature_expired", "signature_failed"] as const) {
      const copy = getSignatureEventNotificationCopy(kind);
      expect(copy?.logOnly).toBe(false);
    }
  });

  it("is log-only for per-signer micro-events and the initial send confirmation", () => {
    for (const kind of ["signer_viewed", "signer_signed", "signature_request_sent"] as const) {
      expect(getSignatureEventNotificationCopy(kind)).toEqual({ logOnly: true });
    }
  });
});
