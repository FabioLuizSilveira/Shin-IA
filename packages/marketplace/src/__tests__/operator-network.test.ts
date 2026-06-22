import { describe, it, expect, beforeEach } from "vitest";
import { OperatorNetwork, computeOperatorScore } from "../operator-network.js";
import { MarketplaceError } from "../partner-registry.js";
import type { OperatorProfile } from "../types.js";

function makeOperator(id = "op1"): OperatorProfile {
  return {
    id,
    tenantId: "t1",
    name: "João Silva",
    status: "active",
    skills: ["electrical", "gps_install"],
    region: "br-sp",
    rating: 4.5,
    jobsCompleted: 20,
    registeredAt: "2024-01-01T00:00:00Z",
  };
}

describe("computeOperatorScore", () => {
  it("computes score from rating and jobs", () => {
    const score = computeOperatorScore(makeOperator());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores are bounded between 0 and 100", () => {
    const high = { ...makeOperator(), rating: 5, jobsCompleted: 10000 };
    const low = { ...makeOperator(), rating: 0, jobsCompleted: 0 };
    expect(computeOperatorScore(high)).toBeLessThanOrEqual(100);
    expect(computeOperatorScore(low)).toBeGreaterThanOrEqual(0);
  });
});

describe("OperatorNetwork", () => {
  let network: OperatorNetwork;

  beforeEach(() => {
    network = new OperatorNetwork();
  });

  describe("register", () => {
    it("registers an operator", () => {
      network.register(makeOperator());
      expect(network.count()).toBe(1);
    });

    it("throws DUPLICATE_OPERATOR for same id", () => {
      network.register(makeOperator());
      expect(() => network.register(makeOperator())).toThrow(MarketplaceError);
    });
  });

  describe("get", () => {
    it("retrieves by id", () => {
      network.register(makeOperator());
      expect(network.get("op1").name).toBe("João Silva");
    });

    it("throws OPERATOR_NOT_FOUND for unknown id", () => {
      expect(() => network.get("missing")).toThrow(MarketplaceError);
    });
  });

  describe("updateStatus", () => {
    it("updates operator status", () => {
      network.register(makeOperator());
      network.updateStatus("op1", "inactive");
      expect(network.get("op1").status).toBe("inactive");
    });

    it("throws OPERATOR_NOT_FOUND for unknown id", () => {
      expect(() => network.updateStatus("missing", "active")).toThrow(MarketplaceError);
    });
  });

  describe("recordJobCompletion", () => {
    it("increments jobsCompleted", () => {
      network.register(makeOperator());
      network.recordJobCompletion("op1");
      expect(network.get("op1").jobsCompleted).toBe(21);
    });

    it("throws OPERATOR_NOT_ACTIVE for inactive operator", () => {
      network.register({ ...makeOperator(), status: "inactive" });
      expect(() => network.recordJobCompletion("op1")).toThrow(MarketplaceError);
    });

    it("throws OPERATOR_NOT_FOUND for unknown id", () => {
      expect(() => network.recordJobCompletion("missing")).toThrow(MarketplaceError);
    });
  });

  describe("updateRating", () => {
    it("updates rating", () => {
      network.register(makeOperator());
      network.updateRating("op1", 5);
      expect(network.get("op1").rating).toBe(5);
    });

    it("throws INVALID_RATING for out-of-range value", () => {
      network.register(makeOperator());
      expect(() => network.updateRating("op1", 6)).toThrow(MarketplaceError);
      expect(() => network.updateRating("op1", -1)).toThrow(MarketplaceError);
    });

    it("throws OPERATOR_NOT_FOUND for unknown id", () => {
      expect(() => network.updateRating("missing", 4)).toThrow(MarketplaceError);
    });
  });

  describe("listByRegion", () => {
    it("filters by region", () => {
      network.register(makeOperator("op1"));
      network.register({ ...makeOperator("op2"), region: "br-rj" });
      expect(network.listByRegion("br-sp")).toHaveLength(1);
    });
  });

  describe("listBySkill", () => {
    it("filters by skill", () => {
      network.register(makeOperator("op1"));
      network.register({ ...makeOperator("op2"), skills: ["painting"] });
      expect(network.listBySkill("electrical")).toHaveLength(1);
    });
  });

  describe("listActive", () => {
    it("returns only active operators", () => {
      network.register(makeOperator("op1"));
      network.register({ ...makeOperator("op2"), status: "inactive" });
      expect(network.listActive()).toHaveLength(1);
    });
  });

  describe("listByTenant", () => {
    it("filters by tenant", () => {
      network.register(makeOperator("op1"));
      network.register({ ...makeOperator("op2"), tenantId: "t2" });
      expect(network.listByTenant("t1")).toHaveLength(1);
    });
  });

  describe("getTopOperators", () => {
    it("returns top N active operators by score", () => {
      network.register({ ...makeOperator("op1"), rating: 5, jobsCompleted: 100 });
      network.register({ ...makeOperator("op2"), rating: 2, jobsCompleted: 1 });
      network.register({ ...makeOperator("op3"), status: "inactive" });
      const top = network.getTopOperators(1);
      expect(top).toHaveLength(1);
      expect(top[0]?.id).toBe("op1");
    });

    it("returns fewer if not enough active operators", () => {
      network.register(makeOperator("op1"));
      expect(network.getTopOperators(10)).toHaveLength(1);
    });
  });
});
