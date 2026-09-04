import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapEnvelopeStatus, mapWebhookEventType } from "./clicksign-status-mapper.js";
import { ClicksignProvider } from "./clicksign.js";

describe("mapEnvelopeStatus", () => {
  it("maps all 4 documented Clicksign envelope statuses", () => {
    expect(mapEnvelopeStatus("draft")).toBe("draft");
    expect(mapEnvelopeStatus("running")).toBe("in_progress");
    expect(mapEnvelopeStatus("closed")).toBe("signed");
    expect(mapEnvelopeStatus("canceled")).toBe("cancelled");
  });

  it("throws loudly on an unmapped status instead of guessing", () => {
    expect(() => mapEnvelopeStatus("expired")).toThrow(/unmapped envelope status/);
  });
});

describe("mapWebhookEventType", () => {
  it("maps the two confirmed webhook event names", () => {
    expect(mapWebhookEventType("document_closed")).toBe("signature_completed");
    expect(mapWebhookEventType("close")).toBe("signature_completed");
  });

  it("throws loudly on an unmapped event type instead of guessing", () => {
    expect(() => mapWebhookEventType("refusal")).toThrow(/unmapped webhook event/);
  });
});

// ── normalizeWebhook HMAC verification ──────────────────────────────────────
// Exercises the real verification code path (not mocked) against a
// self-signed fixture, so a regression in the comparison logic itself
// (wrong header casing, wrong hash construction) is actually caught here —
// the exact header name/algorithm are flagged in this adapter's own
// comments as needing live sandbox confirmation, but the mechanism itself
// (compute HMAC, compare constant-time, reject on mismatch) is real code,
// testable without a live Clicksign account.
describe("ClicksignProvider.normalizeWebhook", () => {
  const secret = "test-webhook-secret";
  const provider = new ClicksignProvider({ apiKey: "unused-in-this-test", webhookSecret: secret });

  // sha256/hex is one of the candidate encodings normalizeWebhook() tries
  // — any candidate matching is sufficient for verification to succeed,
  // so signing with this one exercises the real accept path.
  function sign(rawBody: string): string {
    return createHmac("sha256", secret).update(rawBody).digest("hex");
  }

  it("accepts a correctly-signed document_closed payload and produces a canonical event", async () => {
    const rawBody = JSON.stringify({
      event: { name: "document_closed", occurred_at: "2026-09-03T12:00:00Z" },
      envelope: { id: "env_123" },
    });
    const events = await provider.normalizeWebhook(rawBody, {
      "content-hmac": sign(rawBody),
    });

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("signature_completed");
    expect(events[0].providerRequestId).toBe("env_123");
    expect(events[0].provider).toBe("clicksign");
  });

  it("rejects a payload with a missing signature header", async () => {
    const rawBody = JSON.stringify({ event: { name: "close" }, envelope: { id: "env_123" } });
    await expect(provider.normalizeWebhook(rawBody, {})).rejects.toThrow(/missing content-hmac/);
  });

  it("rejects a payload with a tampered body (signature no longer matches)", async () => {
    const original = JSON.stringify({ event: { name: "close" }, envelope: { id: "env_123" } });
    const signature = sign(original);
    const tampered = JSON.stringify({ event: { name: "close" }, envelope: { id: "env_999" } });

    await expect(
      provider.normalizeWebhook(tampered, { "content-hmac": signature }),
    ).rejects.toThrow(/signature verification failed/);
  });
});
