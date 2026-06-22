import { describe, it, expect, beforeEach } from "vitest";
import { AlertEngine } from "../alerts.js";
import { ObservabilityError } from "../metrics.js";
import type { AlertRule } from "../types.js";

function makeRule(id = "r1", metricName = "error_rate"): AlertRule {
  return {
    id,
    name: "Error Rate Alert",
    metricName,
    threshold: 5,
    severity: "critical",
    state: "ok",
  };
}

describe("AlertEngine", () => {
  let engine: AlertEngine;

  beforeEach(() => {
    engine = new AlertEngine();
  });

  describe("addRule / count", () => {
    it("adds a rule", () => {
      engine.addRule(makeRule());
      expect(engine.count()).toBe(1);
    });

    it("throws DUPLICATE_RULE on duplicate id", () => {
      engine.addRule(makeRule());
      expect(() => engine.addRule(makeRule())).toThrow(ObservabilityError);
    });
  });

  describe("removeRule", () => {
    it("removes a rule", () => {
      engine.addRule(makeRule());
      engine.removeRule("r1");
      expect(engine.count()).toBe(0);
    });

    it("throws RULE_NOT_FOUND for unknown id", () => {
      expect(() => engine.removeRule("missing")).toThrow(ObservabilityError);
    });
  });

  describe("evaluate", () => {
    it("fires rule when value exceeds threshold", () => {
      engine.addRule(makeRule());
      const fired = engine.evaluate("error_rate", 10);
      expect(fired).toHaveLength(1);
      expect(fired[0]?.state).toBe("firing");
    });

    it("does not fire when value is at or below threshold", () => {
      engine.addRule(makeRule());
      expect(engine.evaluate("error_rate", 5)).toHaveLength(0);
      expect(engine.evaluate("error_rate", 3)).toHaveLength(0);
    });

    it("resets to ok when value drops below threshold", () => {
      engine.addRule(makeRule());
      engine.evaluate("error_rate", 10);
      engine.evaluate("error_rate", 1);
      expect(engine.listFiring()).toHaveLength(0);
    });

    it("does not fire acknowledged rules", () => {
      engine.addRule(makeRule());
      engine.evaluate("error_rate", 10);
      engine.acknowledge("r1");
      const fired = engine.evaluate("error_rate", 20);
      expect(fired).toHaveLength(0);
    });

    it("ignores rules for different metrics", () => {
      engine.addRule(makeRule("r1", "latency"));
      expect(engine.evaluate("error_rate", 100)).toHaveLength(0);
    });
  });

  describe("acknowledge", () => {
    it("acknowledges a firing rule", () => {
      engine.addRule(makeRule());
      engine.evaluate("error_rate", 10);
      engine.acknowledge("r1");
      expect(engine.listFiring()).toHaveLength(0);
    });

    it("throws RULE_NOT_FOUND for unknown id", () => {
      expect(() => engine.acknowledge("missing")).toThrow(ObservabilityError);
    });

    it("throws NOT_FIRING when rule is not firing", () => {
      engine.addRule(makeRule());
      expect(() => engine.acknowledge("r1")).toThrow(ObservabilityError);
    });
  });

  describe("listBySeverity", () => {
    it("filters by severity", () => {
      engine.addRule(makeRule("r1"));
      engine.addRule({ ...makeRule("r2"), severity: "warning" });
      expect(engine.listBySeverity("critical")).toHaveLength(1);
      expect(engine.listBySeverity("warning")).toHaveLength(1);
      expect(engine.listBySeverity("info")).toHaveLength(0);
    });
  });

  describe("clearAll", () => {
    it("resets all firing rules to ok", () => {
      engine.addRule(makeRule("r1"));
      engine.addRule(makeRule("r2", "latency"));
      engine.evaluate("error_rate", 100);
      engine.clearAll();
      expect(engine.listFiring()).toHaveLength(0);
    });
  });
});
