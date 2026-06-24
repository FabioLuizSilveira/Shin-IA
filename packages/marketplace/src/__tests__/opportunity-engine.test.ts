import { describe, it, expect, beforeEach } from "vitest";
import { OpportunityEngine, scorePartnerForOpportunity } from "../opportunity-engine.js";
import { MarketplaceError } from "../partner-registry.js";
import type { Opportunity, Partner } from "../types.js";

function makeOpportunity(id = "o1"): Opportunity {
  return {
    id,
    tenantId: "t1",
    title: "Fleet Installation",
    description: "Need partner for fleet setup",
    requiredCapabilities: ["installation", "gps"],
    region: "br-sp",
    estimatedValue: 50000,
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

function makePartner(id = "p1"): Partner {
  return {
    id,
    name: "Acme",
    tier: "gold",
    status: "active",
    capabilities: ["installation", "gps", "maintenance"],
    regions: ["br-sp"],
    rating: 4.5,
    joinedAt: "2024-01-01T00:00:00Z",
  };
}

describe("scorePartnerForOpportunity", () => {
  it("scores full match highly", () => {
    const score = scorePartnerForOpportunity(makePartner(), makeOpportunity());
    expect(score.score).toBeGreaterThan(80);
  });

  it("includes region match reason", () => {
    const { reasons } = scorePartnerForOpportunity(makePartner(), makeOpportunity());
    expect(reasons.some((r) => r.includes("br-sp"))).toBe(true);
  });

  it("includes tier bonus reason", () => {
    const { reasons } = scorePartnerForOpportunity(makePartner(), makeOpportunity());
    expect(reasons.some((r) => r.includes("gold"))).toBe(true);
  });

  it("scores lower for wrong region", () => {
    const partner = { ...makePartner(), regions: ["us-east"] };
    const score = scorePartnerForOpportunity(partner, makeOpportunity());
    expect(score.score).toBeLessThan(80);
  });
});

describe("OpportunityEngine", () => {
  let engine: OpportunityEngine;

  beforeEach(() => {
    engine = new OpportunityEngine();
  });

  describe("create", () => {
    it("creates an opportunity with open status", () => {
      engine.create(makeOpportunity());
      expect(engine.get("o1").status).toBe("open");
    });

    it("throws DUPLICATE_OPPORTUNITY for same id", () => {
      engine.create(makeOpportunity());
      expect(() => engine.create(makeOpportunity())).toThrow(MarketplaceError);
    });
  });

  describe("get", () => {
    it("retrieves by id", () => {
      engine.create(makeOpportunity());
      expect(engine.get("o1").title).toBe("Fleet Installation");
    });

    it("throws OPPORTUNITY_NOT_FOUND for unknown id", () => {
      expect(() => engine.get("missing")).toThrow(MarketplaceError);
    });
  });

  describe("match", () => {
    it("returns scored matches sorted by score descending", () => {
      engine.create(makeOpportunity());
      const p1 = makePartner("p1");
      const p2 = { ...makePartner("p2"), tier: "bronze" as const, regions: ["us-east"] };
      const scores = engine.match("o1", [p1, p2]);
      expect(scores[0]?.partnerId).toBe("p1");
    });

    it("excludes inactive partners", () => {
      engine.create(makeOpportunity());
      const p = { ...makePartner(), status: "suspended" as const };
      expect(engine.match("o1", [p])).toHaveLength(0);
    });

    it("throws OPPORTUNITY_NOT_OPEN when not open", () => {
      engine.create(makeOpportunity());
      engine.close("o1");
      expect(() => engine.match("o1", [makePartner()])).toThrow(MarketplaceError);
    });
  });

  describe("accept", () => {
    it("accepts an open opportunity", () => {
      engine.create(makeOpportunity());
      engine.accept("o1", "p1");
      expect(engine.get("o1").status).toBe("accepted");
      expect(engine.get("o1").matchedPartnerId).toBe("p1");
    });

    it("throws OPPORTUNITY_NOT_FOUND for unknown id", () => {
      expect(() => engine.accept("missing", "p1")).toThrow(MarketplaceError);
    });

    it("throws INVALID_OPPORTUNITY_STATE for closed opportunity", () => {
      engine.create(makeOpportunity());
      engine.close("o1");
      expect(() => engine.accept("o1", "p1")).toThrow(MarketplaceError);
    });
  });

  describe("decline / close", () => {
    it("declines an opportunity", () => {
      engine.create(makeOpportunity());
      engine.decline("o1");
      expect(engine.get("o1").status).toBe("declined");
    });

    it("closes an opportunity", () => {
      engine.create(makeOpportunity());
      engine.close("o1");
      expect(engine.get("o1").status).toBe("closed");
    });
  });

  describe("listByStatus", () => {
    it("filters by status", () => {
      engine.create(makeOpportunity("o1"));
      engine.create(makeOpportunity("o2"));
      engine.close("o2");
      expect(engine.listByStatus("open")).toHaveLength(1);
      expect(engine.listByStatus("closed")).toHaveLength(1);
    });
  });

  describe("listByTenant", () => {
    it("filters by tenant", () => {
      engine.create(makeOpportunity("o1"));
      engine.create({ ...makeOpportunity("o2"), tenantId: "t2" });
      expect(engine.listByTenant("t1")).toHaveLength(1);
    });
  });

  describe("listExpired", () => {
    it("returns open opportunities past their expiry", () => {
      engine.create({ ...makeOpportunity(), expiresAt: "2020-01-01T00:00:00Z" });
      expect(engine.listExpired()).toHaveLength(1);
    });

    it("does not return non-expired opportunities", () => {
      engine.create({ ...makeOpportunity(), expiresAt: "2099-01-01T00:00:00Z" });
      expect(engine.listExpired()).toHaveLength(0);
    });
  });
});
