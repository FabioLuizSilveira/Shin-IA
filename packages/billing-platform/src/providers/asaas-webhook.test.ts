import { describe, expect, it } from "vitest";
import { mapAsaasEventToNormalized } from "./asaas.js";

describe("mapAsaasEventToNormalized", () => {
  it("maps SUBSCRIPTION_CREATED to checkout_completed, with authUserId left null", () => {
    const normalized = mapAsaasEventToNormalized({
      id: "evt_1",
      event: "SUBSCRIPTION_CREATED",
      subscription: {
        id: "sub_asaas_1",
        customer: "cus_asaas_1",
        status: "ACTIVE",
        externalReference: "ref-uuid-123",
      },
    });

    expect(normalized.provider).toBe("asaas");
    expect(normalized.gatewayEventId).toBe("evt_1");
    expect(normalized.kind).toBe("checkout_completed");
    // Deliberately null -- Asaas never carries our internal user id
    // directly, only commercial-platform (which has schema access to
    // checkout_session_references) can resolve it from checkoutRefId.
    expect(normalized.authUserId).toBeNull();
    expect(normalized.gatewayCustomerId).toBe("cus_asaas_1");
    expect(normalized.gatewaySubscriptionId).toBe("sub_asaas_1");
    expect(normalized.checkoutRefId).toBe("ref-uuid-123");
  });

  it("maps SUBSCRIPTION_UPDATED to subscription_updated with the normalized status vocabulary", () => {
    const normalized = mapAsaasEventToNormalized({
      id: "evt_2",
      event: "SUBSCRIPTION_UPDATED",
      subscription: {
        id: "sub_asaas_1",
        customer: "cus_asaas_1",
        status: "ACTIVE",
        externalReference: null,
      },
    });
    expect(normalized.kind).toBe("subscription_updated");
    expect(normalized.gatewaySubscriptionId).toBe("sub_asaas_1");
    expect(normalized.status).toBe("active");
  });

  it("maps an unrecognized Asaas subscription status to pending rather than guessing", () => {
    const normalized = mapAsaasEventToNormalized({
      id: "evt_3",
      event: "SUBSCRIPTION_UPDATED",
      subscription: {
        id: "sub_1",
        customer: "cus_1",
        status: "SOMETHING_NEW",
        externalReference: null,
      },
    });
    expect(normalized.status).toBe("pending");
  });

  it("maps both SUBSCRIPTION_INACTIVATED and SUBSCRIPTION_DELETED to subscription_cancelled", () => {
    for (const event of ["SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED"]) {
      const normalized = mapAsaasEventToNormalized({
        id: `evt_${event}`,
        event,
        subscription: {
          id: "sub_1",
          customer: "cus_1",
          status: "INACTIVE",
          externalReference: null,
        },
      });
      expect(normalized.kind).toBe("subscription_cancelled");
      expect(normalized.gatewaySubscriptionId).toBe("sub_1");
    }
  });

  it("never acts on PAYMENT_* events this round -- logged only, kind null", () => {
    const normalized = mapAsaasEventToNormalized({
      id: "evt_payment",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_1", subscription: "sub_1", status: "CONFIRMED", externalReference: null },
    });
    expect(normalized.kind).toBeNull();
    // Still logged for idempotency/audit -- rawPayload carries the
    // payment object even though nothing acts on it yet.
    expect(normalized.rawPayload).toMatchObject({ id: "pay_1" });
  });

  it("never crashes and returns kind: null when the expected nested object is missing", () => {
    const normalized = mapAsaasEventToNormalized({
      id: "evt_weird",
      event: "SUBSCRIPTION_CREATED",
    });
    expect(normalized.kind).toBeNull();
  });

  it("returns kind: null for a completely unknown event type", () => {
    const normalized = mapAsaasEventToNormalized({
      id: "evt_x",
      event: "SOMETHING_ASAAS_ADDS_LATER",
    });
    expect(normalized.kind).toBeNull();
  });
});
