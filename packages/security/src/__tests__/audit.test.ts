import { describe, it, expect, beforeEach } from "vitest";
import { AuditLogger } from "../audit.js";
import { SecurityError } from "../iam.js";
import type { AuditEntry } from "../types.js";

function makeEntry(id = "a1", tenantId = "t1"): AuditEntry {
  return {
    id,
    tenantId,
    actorId: "u1",
    eventType: "access",
    resource: "contracts",
    action: "read",
    outcome: "success",
    timestamp: "2024-01-01T10:00:00Z",
  };
}

describe("AuditLogger", () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  describe("log", () => {
    it("logs an entry", () => {
      logger.log(makeEntry());
      expect(logger.count()).toBe(1);
    });

    it("attaches a checksum", () => {
      logger.log(makeEntry());
      const entries = logger.query("t1");
      expect(entries[0]?.checksum).toBeTruthy();
    });

    it("throws DUPLICATE_AUDIT_ENTRY on duplicate id", () => {
      logger.log(makeEntry());
      expect(() => logger.log(makeEntry())).toThrow(SecurityError);
    });
  });

  describe("query", () => {
    it("filters by tenantId", () => {
      logger.log(makeEntry("a1", "t1"));
      logger.log(makeEntry("a2", "t2"));
      expect(logger.query("t1")).toHaveLength(1);
    });

    it("filters by eventType when provided", () => {
      logger.log(makeEntry("a1"));
      logger.log({ ...makeEntry("a2"), eventType: "auth" });
      expect(logger.query("t1", "auth")).toHaveLength(1);
    });

    it("returns all tenant entries when no eventType filter", () => {
      logger.log(makeEntry("a1"));
      logger.log({ ...makeEntry("a2"), eventType: "auth" });
      expect(logger.query("t1")).toHaveLength(2);
    });
  });

  describe("validateIntegrity", () => {
    it("returns true for unmodified entry", () => {
      logger.log(makeEntry());
      expect(logger.validateIntegrity("a1")).toBe(true);
    });

    it("throws AUDIT_NOT_FOUND for unknown id", () => {
      expect(() => logger.validateIntegrity("missing")).toThrow(SecurityError);
    });
  });

  describe("exportAuditTrail", () => {
    it("returns entries sorted by timestamp", () => {
      logger.log({ ...makeEntry("a1"), timestamp: "2024-01-01T12:00:00Z" });
      logger.log({ ...makeEntry("a2"), timestamp: "2024-01-01T08:00:00Z" });
      const trail = logger.exportAuditTrail("t1");
      expect(trail[0]?.id).toBe("a2");
      expect(trail[1]?.id).toBe("a1");
    });

    it("filters by tenant", () => {
      logger.log(makeEntry("a1", "t1"));
      logger.log(makeEntry("a2", "t2"));
      expect(logger.exportAuditTrail("t1")).toHaveLength(1);
    });
  });

  describe("detectAnomalies", () => {
    it("returns failures when count reaches threshold", () => {
      logger.log({ ...makeEntry("a1"), outcome: "failure" });
      logger.log({ ...makeEntry("a2"), outcome: "failure" });
      logger.log({ ...makeEntry("a3"), outcome: "failure" });
      expect(logger.detectAnomalies("t1", 3)).toHaveLength(3);
    });

    it("returns empty when below threshold", () => {
      logger.log({ ...makeEntry("a1"), outcome: "failure" });
      expect(logger.detectAnomalies("t1", 5)).toHaveLength(0);
    });

    it("ignores success entries", () => {
      logger.log(makeEntry("a1"));
      expect(logger.detectAnomalies("t1", 1)).toHaveLength(0);
    });
  });
});
