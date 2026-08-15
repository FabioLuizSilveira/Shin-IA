import { describe, it, expect } from "vitest";
import { customerOrganizationIds } from "../../lib/mobile-contracts-scope";
import type { CustomerMobileContext } from "../../lib/mobile-context";

describe("customerOrganizationIds", () => {
  it("extracts organizationIds from the resolved customer context, cross-customer isolated by construction", () => {
    const context: CustomerMobileContext = {
      userType: "customer",
      userId: "u1",
      email: null,
      customerId: "cust-1",
      organizations: [
        { organizationId: "org-a", tenantId: "tenant-1" },
        { organizationId: "org-b", tenantId: "tenant-2" },
      ],
      db: {} as CustomerMobileContext["db"],
    };
    expect(customerOrganizationIds(context)).toEqual(["org-a", "org-b"]);
  });

  it("returns an empty list for a customer with zero organization links", () => {
    const context: CustomerMobileContext = {
      userType: "customer",
      userId: "u2",
      email: null,
      customerId: "cust-2",
      organizations: [],
      db: {} as CustomerMobileContext["db"],
    };
    expect(customerOrganizationIds(context)).toEqual([]);
  });
});
