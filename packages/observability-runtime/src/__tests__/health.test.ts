import { describe, it, expect, beforeEach } from "vitest";
import { HealthAggregator } from "../health.js";
import { ObservabilityError } from "../metrics.js";
import type { HealthCheckResult } from "../types.js";

function makeResult(status: HealthCheckResult["status"] = "healthy"): HealthCheckResult {
  return { name: "api", status, checkedAt: new Date().toISOString() };
}

describe("HealthAggregator", () => {
  let agg: HealthAggregator;

  beforeEach(() => {
    agg = new HealthAggregator();
  });

  describe("register / runCheck", () => {
    it("registers and runs a check", async () => {
      agg.register("api", () => makeResult("healthy"));
      const result = await agg.runCheck("api");
      expect(result.status).toBe("healthy");
    });

    it("throws CHECK_NOT_FOUND for unknown check", async () => {
      await expect(() => agg.runCheck("missing")).rejects.toThrow(ObservabilityError);
    });
  });

  describe("unregister", () => {
    it("removes a check", () => {
      agg.register("api", () => makeResult());
      agg.unregister("api");
      expect(() => agg.runCheck("api")).rejects.toThrow(ObservabilityError);
    });

    it("throws CHECK_NOT_FOUND for unknown check", () => {
      expect(() => agg.unregister("missing")).toThrow(ObservabilityError);
    });
  });

  describe("runAll", () => {
    it("runs all registered checks", async () => {
      agg.register("api", () => makeResult("healthy"));
      agg.register("db", () => makeResult("degraded"));
      const results = await agg.runAll();
      expect(results).toHaveLength(2);
    });

    it("returns empty for no checks", async () => {
      expect(await agg.runAll()).toHaveLength(0);
    });
  });

  describe("computeOverallHealth", () => {
    it("returns healthy for all healthy", () => {
      expect(agg.computeOverallHealth([makeResult("healthy"), makeResult("healthy")])).toBe(
        "healthy",
      );
    });

    it("returns healthy for empty", () => {
      expect(agg.computeOverallHealth([])).toBe("healthy");
    });

    it("returns down when any is down", () => {
      expect(agg.computeOverallHealth([makeResult("healthy"), makeResult("down")])).toBe("down");
    });

    it("returns degraded when mix of healthy/degraded", () => {
      expect(agg.computeOverallHealth([makeResult("healthy"), makeResult("degraded")])).toBe(
        "degraded",
      );
    });
  });

  describe("getReport", () => {
    it("returns report with status and checks", async () => {
      agg.register("api", () => makeResult("healthy"));
      const report = await agg.getReport();
      expect(report.status).toBe("healthy");
      expect(report.checks).toHaveLength(1);
    });
  });
});
