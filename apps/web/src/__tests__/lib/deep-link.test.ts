import { describe, it, expect } from "vitest";
import { buildDeepLinkUrl } from "../../lib/push/deep-link";

describe("buildDeepLinkUrl", () => {
  it("builds a URL for every known target type, always under the registered scheme", () => {
    expect(buildDeepLinkUrl({ type: "operation", id: "op-1" })).toBe(
      "shinacustomer://operations/op-1",
    );
    expect(buildDeepLinkUrl({ type: "contract", id: "c-1" })).toBe("shinacustomer://contracts/c-1");
    expect(buildDeepLinkUrl({ type: "document", contractId: "c-1", id: "d-1" })).toBe(
      "shinacustomer://contracts/c-1/documents/d-1",
    );
    expect(buildDeepLinkUrl({ type: "tracking_alert", resourceId: "r-1" })).toBe(
      "shinacustomer://tracking/r-1",
    );
    expect(buildDeepLinkUrl({ type: "invoice", id: "i-1" })).toBe("shinacustomer://invoices/i-1");
    expect(buildDeepLinkUrl({ type: "notification_center" })).toBe("shinacustomer://notifications");
    expect(buildDeepLinkUrl({ type: "asset", id: "a-1" })).toBe("shinacustomer://assets/a-1");
  });
});
