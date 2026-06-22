import { describe, it, expect, beforeEach } from "vitest";
import { OfflineSyncEngine, MobileRuntimeError } from "../offline-sync.js";

function makeItem(id: string, priority = 5, maxRetries = 3) {
  return {
    id,
    operation: "create" as const,
    entityType: "contract",
    entityId: `e-${id}`,
    payload: { key: "val" },
    priority,
    maxRetries,
  };
}

describe("OfflineSyncEngine", () => {
  let engine: OfflineSyncEngine;

  beforeEach(() => {
    engine = new OfflineSyncEngine();
  });

  describe("enqueue", () => {
    it("adds item to queue", () => {
      engine.enqueue(makeItem("a"));
      expect(engine.getQueueSize()).toBe(1);
    });

    it("sets status to pending on first enqueue", () => {
      engine.enqueue(makeItem("a"));
      expect(engine.getSyncStatus()).toBe("pending");
    });

    it("sets retryCount to 0", () => {
      const item = engine.enqueue(makeItem("a"));
      expect(item.retryCount).toBe(0);
    });

    it("sets createdAt", () => {
      const item = engine.enqueue(makeItem("a"));
      expect(item.createdAt).toBeTruthy();
    });
  });

  describe("dequeue", () => {
    it("returns undefined on empty queue", () => {
      expect(engine.dequeue()).toBeUndefined();
    });

    it("returns highest priority item", () => {
      engine.enqueue(makeItem("low", 1));
      engine.enqueue(makeItem("high", 10));
      const result = engine.dequeue();
      expect(result?.id).toBe("high");
    });

    it("removes item from queue", () => {
      engine.enqueue(makeItem("a"));
      engine.dequeue();
      expect(engine.getQueueSize()).toBe(0);
    });
  });

  describe("peek", () => {
    it("returns undefined on empty queue", () => {
      expect(engine.peek()).toBeUndefined();
    });

    it("does not remove item", () => {
      engine.enqueue(makeItem("a"));
      engine.peek();
      expect(engine.getQueueSize()).toBe(1);
    });

    it("returns highest priority without removing", () => {
      engine.enqueue(makeItem("lo", 1));
      engine.enqueue(makeItem("hi", 10));
      expect(engine.peek()?.id).toBe("hi");
    });
  });

  describe("markAttempt", () => {
    it("increments retryCount", () => {
      engine.enqueue(makeItem("a"));
      engine.markAttempt("a");
      const item = engine.peek();
      expect(item?.retryCount).toBe(1);
    });

    it("throws ITEM_NOT_FOUND for missing id", () => {
      expect(() => engine.markAttempt("missing")).toThrow(MobileRuntimeError);
    });
  });

  describe("remove", () => {
    it("removes item by id", () => {
      engine.enqueue(makeItem("a"));
      engine.remove("a");
      expect(engine.getQueueSize()).toBe(0);
    });

    it("sets status to idle when queue empties", () => {
      engine.enqueue(makeItem("a"));
      engine.remove("a");
      expect(engine.getSyncStatus()).toBe("idle");
    });

    it("throws ITEM_NOT_FOUND for missing id", () => {
      expect(() => engine.remove("missing")).toThrow(MobileRuntimeError);
    });
  });

  describe("setSyncStatus / getSyncStatus", () => {
    it("updates status", () => {
      engine.setSyncStatus("syncing");
      expect(engine.getSyncStatus()).toBe("syncing");
    });

    it("can set error status", () => {
      engine.setSyncStatus("error");
      expect(engine.getSyncStatus()).toBe("error");
    });
  });

  describe("clearQueue", () => {
    it("empties queue and resets status", () => {
      engine.enqueue(makeItem("a"));
      engine.enqueue(makeItem("b"));
      engine.clearQueue();
      expect(engine.getQueueSize()).toBe(0);
      expect(engine.getSyncStatus()).toBe("idle");
    });
  });

  describe("listByOperation", () => {
    it("filters by operation type", () => {
      engine.enqueue({ ...makeItem("a"), operation: "create" });
      engine.enqueue({ ...makeItem("b"), operation: "delete" });
      expect(engine.listByOperation("create")).toHaveLength(1);
      expect(engine.listByOperation("delete")).toHaveLength(1);
      expect(engine.listByOperation("update")).toHaveLength(0);
    });
  });

  describe("listExhausted", () => {
    it("returns items at max retries", () => {
      engine.enqueue(makeItem("a", 5, 1));
      engine.markAttempt("a");
      expect(engine.listExhausted()).toHaveLength(1);
    });

    it("excludes items under max retries", () => {
      engine.enqueue(makeItem("a", 5, 3));
      engine.markAttempt("a");
      expect(engine.listExhausted()).toHaveLength(0);
    });
  });
});
