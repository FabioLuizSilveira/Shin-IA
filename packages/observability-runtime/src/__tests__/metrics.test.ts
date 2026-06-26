import { describe, it, expect, beforeEach } from "vitest";
import { MetricsCollector } from "../metrics.js";

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe("record / count", () => {
    it("records a sample", () => {
      collector.record({
        name: "requests",
        type: "counter",
        value: 1,
        timestamp: "2024-01-01T00:00:00Z",
      });
      expect(collector.count()).toBe(1);
    });

    it("uses provided timestamp", () => {
      collector.record({
        name: "requests",
        type: "counter",
        value: 1,
        timestamp: "2024-06-01T00:00:00Z",
      });
      expect(collector.getLatest("requests")?.timestamp).toBe("2024-06-01T00:00:00Z");
    });
  });

  describe("increment", () => {
    it("starts at 1 for first increment", () => {
      collector.increment("hits");
      expect(collector.getLatest("hits")?.value).toBe(1);
    });

    it("adds to existing value", () => {
      collector.increment("hits");
      collector.increment("hits");
      expect(collector.getLatest("hits")?.value).toBe(2);
    });

    it("uses counter type", () => {
      collector.increment("hits");
      expect(collector.getLatest("hits")?.type).toBe("counter");
    });
  });

  describe("gauge", () => {
    it("records gauge value", () => {
      collector.gauge("memory", 75.5);
      expect(collector.getLatest("memory")?.value).toBe(75.5);
      expect(collector.getLatest("memory")?.type).toBe("gauge");
    });
  });

  describe("histogram", () => {
    it("records histogram value", () => {
      collector.histogram("latency", 120);
      expect(collector.getLatest("latency")?.type).toBe("histogram");
    });
  });

  describe("getLatest", () => {
    it("returns undefined for unknown metric", () => {
      expect(collector.getLatest("unknown")).toBeUndefined();
    });

    it("returns last recorded sample", () => {
      collector.record({
        name: "req",
        type: "counter",
        value: 1,
        timestamp: "2024-01-01T00:00:00Z",
      });
      collector.record({
        name: "req",
        type: "counter",
        value: 5,
        timestamp: "2024-01-02T00:00:00Z",
      });
      expect(collector.getLatest("req")?.value).toBe(5);
    });

    it("filters by labels when provided", () => {
      collector.gauge("mem", 50, { region: "us" });
      collector.gauge("mem", 80, { region: "eu" });
      expect(collector.getLatest("mem", { region: "us" })?.value).toBe(50);
    });
  });

  describe("getSummary", () => {
    it("returns zeros for unknown metric", () => {
      const s = collector.getSummary("unknown");
      expect(s.count).toBe(0);
      expect(s.sum).toBe(0);
    });

    it("computes correct summary", () => {
      collector.histogram("latency", 10);
      collector.histogram("latency", 20);
      collector.histogram("latency", 30);
      const s = collector.getSummary("latency");
      expect(s.count).toBe(3);
      expect(s.sum).toBe(60);
      expect(s.min).toBe(10);
      expect(s.max).toBe(30);
      expect(s.avg).toBe(20);
    });
  });

  describe("listByType", () => {
    it("filters by metric type", () => {
      collector.increment("hits");
      collector.gauge("memory", 50);
      expect(collector.listByType("counter")).toHaveLength(1);
      expect(collector.listByType("gauge")).toHaveLength(1);
      expect(collector.listByType("histogram")).toHaveLength(0);
    });
  });

  describe("flush", () => {
    it("returns all samples and clears collector", () => {
      collector.increment("a");
      collector.gauge("b", 5);
      const flushed = collector.flush();
      expect(flushed).toHaveLength(2);
      expect(collector.count()).toBe(0);
    });
  });
});
