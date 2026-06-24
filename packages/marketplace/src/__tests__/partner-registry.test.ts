import { describe, it, expect, beforeEach } from "vitest";
import { PartnerRegistry, MarketplaceError } from "../partner-registry.js";
import type { Partner } from "../types.js";

function makePartner(id = "p1"): Partner {
  return {
    id,
    name: "Acme Partner",
    tier: "silver",
    status: "active",
    capabilities: ["installation", "maintenance"],
    regions: ["br-sp", "br-rj"],
    rating: 4.5,
    joinedAt: "2024-01-01T00:00:00Z",
  };
}

describe("PartnerRegistry", () => {
  let registry: PartnerRegistry;

  beforeEach(() => {
    registry = new PartnerRegistry();
  });

  describe("register", () => {
    it("registers a partner", () => {
      registry.register(makePartner());
      expect(registry.count()).toBe(1);
    });

    it("throws DUPLICATE_PARTNER for same id", () => {
      registry.register(makePartner());
      expect(() => registry.register(makePartner())).toThrow(MarketplaceError);
    });
  });

  describe("get", () => {
    it("returns partner by id", () => {
      registry.register(makePartner("p1"));
      expect(registry.get("p1").name).toBe("Acme Partner");
    });

    it("throws PARTNER_NOT_FOUND for unknown id", () => {
      expect(() => registry.get("missing")).toThrow(MarketplaceError);
    });
  });

  describe("updateStatus", () => {
    it("updates partner status", () => {
      registry.register(makePartner());
      registry.updateStatus("p1", "suspended");
      expect(registry.get("p1").status).toBe("suspended");
    });

    it("throws PARTNER_NOT_FOUND for unknown id", () => {
      expect(() => registry.updateStatus("missing", "active")).toThrow(MarketplaceError);
    });
  });

  describe("updateTier", () => {
    it("updates partner tier", () => {
      registry.register(makePartner());
      registry.updateTier("p1", "gold");
      expect(registry.get("p1").tier).toBe("gold");
    });

    it("throws PARTNER_NOT_FOUND for unknown id", () => {
      expect(() => registry.updateTier("missing", "gold")).toThrow(MarketplaceError);
    });
  });

  describe("listByTier", () => {
    it("filters by tier", () => {
      registry.register(makePartner("p1"));
      registry.register({ ...makePartner("p2"), tier: "gold" });
      expect(registry.listByTier("silver")).toHaveLength(1);
      expect(registry.listByTier("gold")).toHaveLength(1);
      expect(registry.listByTier("platinum")).toHaveLength(0);
    });
  });

  describe("listActive", () => {
    it("returns only active partners", () => {
      registry.register(makePartner("p1"));
      registry.register({ ...makePartner("p2"), status: "suspended" });
      expect(registry.listActive()).toHaveLength(1);
    });
  });

  describe("listByRegion", () => {
    it("returns partners in the region", () => {
      registry.register(makePartner("p1"));
      registry.register({ ...makePartner("p2"), regions: ["us-east"] });
      expect(registry.listByRegion("br-sp")).toHaveLength(1);
    });
  });

  describe("listByCapability", () => {
    it("returns partners with the capability", () => {
      registry.register(makePartner("p1"));
      registry.register({ ...makePartner("p2"), capabilities: ["training"] });
      expect(registry.listByCapability("installation")).toHaveLength(1);
      expect(registry.listByCapability("training")).toHaveLength(1);
    });
  });

  describe("computeAverageRating", () => {
    it("returns 0 for empty registry", () => {
      expect(registry.computeAverageRating()).toBe(0);
    });

    it("computes average correctly", () => {
      registry.register({ ...makePartner("p1"), rating: 4 });
      registry.register({ ...makePartner("p2"), rating: 5 });
      expect(registry.computeAverageRating()).toBe(4.5);
    });
  });
});
