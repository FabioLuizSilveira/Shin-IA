import { describe, it, expect, beforeEach } from "vitest";
import { TrackingEngine } from "../tracking.js";
import type { TrackingEvent } from "../types.js";

function makeEvent(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    id: "ev1",
    tenantId: "t1",
    userId: "u1",
    type: "location",
    latitude: -23.5505,
    longitude: -46.6333,
    timestamp: "2024-01-01T10:00:00Z",
    ...overrides,
  };
}

describe("TrackingEngine", () => {
  let engine: TrackingEngine;

  beforeEach(() => {
    engine = new TrackingEngine();
  });

  describe("recordEvent / count", () => {
    it("records events", () => {
      engine.recordEvent(makeEvent());
      expect(engine.count()).toBe(1);
    });

    it("records multiple events", () => {
      engine.recordEvent(makeEvent({ id: "a" }));
      engine.recordEvent(makeEvent({ id: "b" }));
      expect(engine.count()).toBe(2);
    });
  });

  describe("getEventHistory", () => {
    it("filters by tenantId", () => {
      engine.recordEvent(makeEvent({ tenantId: "t1" }));
      engine.recordEvent(makeEvent({ id: "e2", tenantId: "t2" }));
      expect(engine.getEventHistory("t1")).toHaveLength(1);
    });

    it("filters by userId when provided", () => {
      engine.recordEvent(makeEvent({ userId: "u1" }));
      engine.recordEvent(makeEvent({ id: "e2", userId: "u2" }));
      expect(engine.getEventHistory("t1", "u1")).toHaveLength(1);
    });

    it("returns all tenant events when userId is omitted", () => {
      engine.recordEvent(makeEvent({ userId: "u1" }));
      engine.recordEvent(makeEvent({ id: "e2", userId: "u2" }));
      expect(engine.getEventHistory("t1")).toHaveLength(2);
    });
  });

  describe("filterByType", () => {
    it("filters by event type", () => {
      engine.recordEvent(makeEvent({ type: "location" }));
      engine.recordEvent(makeEvent({ id: "e2", type: "checkin" }));
      expect(engine.filterByType("location")).toHaveLength(1);
      expect(engine.filterByType("checkin")).toHaveLength(1);
    });
  });

  describe("filterByAsset", () => {
    it("filters by assetId", () => {
      engine.recordEvent(makeEvent({ assetId: "asset-1" }));
      engine.recordEvent(makeEvent({ id: "e2", assetId: "asset-2" }));
      expect(engine.filterByAsset("asset-1")).toHaveLength(1);
    });

    it("returns empty when no match", () => {
      engine.recordEvent(makeEvent({ assetId: "asset-1" }));
      expect(engine.filterByAsset("unknown")).toHaveLength(0);
    });
  });

  describe("computeRoute / getTotalDistance", () => {
    it("returns empty route for no events", () => {
      expect(engine.computeRoute("u1", "t1")).toHaveLength(0);
    });

    it("returns empty route for single event", () => {
      engine.recordEvent(makeEvent());
      expect(engine.computeRoute("u1", "t1")).toHaveLength(0);
    });

    it("computes route segments for two location events", () => {
      engine.recordEvent(
        makeEvent({ id: "a", timestamp: "2024-01-01T10:00:00Z", latitude: 0, longitude: 0 }),
      );
      engine.recordEvent(
        makeEvent({ id: "b", timestamp: "2024-01-01T10:01:00Z", latitude: 0, longitude: 1 }),
      );
      const route = engine.computeRoute("u1", "t1");
      expect(route).toHaveLength(1);
      expect(route[0]?.distanceKm).toBeGreaterThan(0);
    });

    it("excludes non-location events from route", () => {
      engine.recordEvent(makeEvent({ id: "a", type: "checkin" }));
      expect(engine.computeRoute("u1", "t1")).toHaveLength(0);
    });

    it("getTotalDistance returns 0 for no events", () => {
      expect(engine.getTotalDistance("u1", "t1")).toBe(0);
    });

    it("getTotalDistance sums segment distances", () => {
      engine.recordEvent(
        makeEvent({ id: "a", timestamp: "2024-01-01T10:00:00Z", latitude: 0, longitude: 0 }),
      );
      engine.recordEvent(
        makeEvent({ id: "b", timestamp: "2024-01-01T10:01:00Z", latitude: 0, longitude: 1 }),
      );
      expect(engine.getTotalDistance("u1", "t1")).toBeGreaterThan(0);
    });
  });

  describe("clearHistory", () => {
    it("removes all events for tenant", () => {
      engine.recordEvent(makeEvent({ tenantId: "t1" }));
      engine.recordEvent(makeEvent({ id: "e2", tenantId: "t2" }));
      engine.clearHistory("t1");
      expect(engine.count()).toBe(1);
      expect(engine.getEventHistory("t2")).toHaveLength(1);
    });
  });
});
