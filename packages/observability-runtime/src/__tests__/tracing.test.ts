import { describe, it, expect, beforeEach } from "vitest";
import { TracingEngine } from "../tracing.js";
import { ObservabilityError } from "../metrics.js";

function makeSpan(id = "s1", traceId = "t1") {
  return {
    id,
    traceId,
    name: "db.query",
    startTime: new Date().toISOString(),
    status: "unset" as const,
  };
}

describe("TracingEngine", () => {
  let engine: TracingEngine;

  beforeEach(() => {
    engine = new TracingEngine();
  });

  describe("startSpan", () => {
    it("creates a span", () => {
      engine.startSpan(makeSpan());
      expect(engine.count()).toBe(1);
    });

    it("throws DUPLICATE_SPAN for same id", () => {
      engine.startSpan(makeSpan());
      expect(() => engine.startSpan(makeSpan())).toThrow(ObservabilityError);
    });
  });

  describe("endSpan", () => {
    it("sets endTime and durationMs", () => {
      engine.startSpan(makeSpan());
      const ended = engine.endSpan("s1", "ok");
      expect(ended.endTime).toBeTruthy();
      expect(ended.durationMs).toBeGreaterThanOrEqual(0);
      expect(ended.status).toBe("ok");
    });

    it("throws SPAN_NOT_FOUND for unknown id", () => {
      expect(() => engine.endSpan("missing")).toThrow(ObservabilityError);
    });

    it("throws SPAN_ALREADY_ENDED when called twice", () => {
      engine.startSpan(makeSpan());
      engine.endSpan("s1");
      expect(() => engine.endSpan("s1")).toThrow(ObservabilityError);
    });
  });

  describe("addEvent", () => {
    it("appends event to span", () => {
      engine.startSpan(makeSpan());
      engine.addEvent("s1", "db.connect");
      const span = engine.getSpan("s1");
      expect(span.events).toContain("db.connect");
    });

    it("throws SPAN_NOT_FOUND for unknown id", () => {
      expect(() => engine.addEvent("missing", "event")).toThrow(ObservabilityError);
    });
  });

  describe("setTag", () => {
    it("adds tag to span", () => {
      engine.startSpan(makeSpan());
      engine.setTag("s1", "env", "prod");
      const span = engine.getSpan("s1");
      expect(span.tags?.["env"]).toBe("prod");
    });

    it("throws SPAN_NOT_FOUND for unknown id", () => {
      expect(() => engine.setTag("missing", "k", "v")).toThrow(ObservabilityError);
    });
  });

  describe("getSpan", () => {
    it("retrieves span by id", () => {
      engine.startSpan(makeSpan("s1", "trace1"));
      expect(engine.getSpan("s1").traceId).toBe("trace1");
    });

    it("throws SPAN_NOT_FOUND for unknown id", () => {
      expect(() => engine.getSpan("missing")).toThrow(ObservabilityError);
    });
  });

  describe("getTrace", () => {
    it("returns all spans for a traceId", () => {
      engine.startSpan(makeSpan("s1", "t1"));
      engine.startSpan(makeSpan("s2", "t1"));
      engine.startSpan(makeSpan("s3", "t2"));
      expect(engine.getTrace("t1")).toHaveLength(2);
    });

    it("returns empty for unknown traceId", () => {
      expect(engine.getTrace("unknown")).toHaveLength(0);
    });
  });

  describe("listByStatus", () => {
    it("filters by status", () => {
      engine.startSpan(makeSpan("s1"));
      engine.startSpan(makeSpan("s2", "t2"));
      engine.endSpan("s1", "error");
      expect(engine.listByStatus("error")).toHaveLength(1);
      expect(engine.listByStatus("unset")).toHaveLength(1);
    });
  });
});
