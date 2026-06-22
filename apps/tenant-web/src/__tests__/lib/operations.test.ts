import { describe, it, expect } from "vitest";
import {
  computeOperationStatus,
  sortByPriority,
  countByStatus,
  filterByAssignee,
} from "../../lib/operations.js";
import type { Operation } from "../../lib/types.js";

function makeOp(overrides: Partial<Operation> = {}): Operation {
  return {
    id: "op1",
    title: "Test Op",
    status: "pending",
    priority: 5,
    ...overrides,
  };
}

describe("computeOperationStatus", () => {
  it("returns completed as-is", () => {
    expect(computeOperationStatus(makeOp({ status: "completed" }))).toBe("completed");
  });

  it("returns cancelled as-is", () => {
    expect(computeOperationStatus(makeOp({ status: "cancelled" }))).toBe("cancelled");
  });

  it("returns overdue when dueDate is past and not completed", () => {
    const op = makeOp({ dueDate: "2020-01-01", status: "in_progress" });
    expect(computeOperationStatus(op)).toBe("overdue");
  });

  it("returns current status when due date is future", () => {
    const op = makeOp({ dueDate: "2099-12-31", status: "pending" });
    expect(computeOperationStatus(op)).toBe("pending");
  });

  it("returns current status when no dueDate", () => {
    const op = makeOp({ status: "in_progress" });
    expect(computeOperationStatus(op)).toBe("in_progress");
  });
});

describe("sortByPriority", () => {
  it("sorts descending by priority", () => {
    const ops = [
      makeOp({ id: "a", priority: 1 }),
      makeOp({ id: "b", priority: 10 }),
      makeOp({ id: "c", priority: 5 }),
    ];
    const sorted = sortByPriority(ops);
    expect(sorted[0]?.id).toBe("b");
    expect(sorted[1]?.id).toBe("c");
    expect(sorted[2]?.id).toBe("a");
  });

  it("does not mutate original", () => {
    const ops = [makeOp({ priority: 2 }), makeOp({ id: "b", priority: 10 })];
    sortByPriority(ops);
    expect(ops[0]?.priority).toBe(2);
  });
});

describe("countByStatus", () => {
  it("returns zeros for empty", () => {
    const counts = countByStatus([]);
    expect(counts.pending).toBe(0);
    expect(counts.in_progress).toBe(0);
    expect(counts.completed).toBe(0);
    expect(counts.cancelled).toBe(0);
    expect(counts.overdue).toBe(0);
  });

  it("counts pending and completed", () => {
    const ops = [makeOp({ status: "pending" }), makeOp({ id: "b", status: "completed" })];
    const counts = countByStatus(ops);
    expect(counts.pending).toBe(1);
    expect(counts.completed).toBe(1);
  });

  it("counts overdue via computeOperationStatus", () => {
    const ops = [makeOp({ dueDate: "2020-01-01", status: "in_progress" })];
    const counts = countByStatus(ops);
    expect(counts.overdue).toBe(1);
    expect(counts.in_progress).toBe(0);
  });
});

describe("filterByAssignee", () => {
  it("filters by assigned user", () => {
    const ops = [makeOp({ assignedTo: "alice" }), makeOp({ id: "b", assignedTo: "bob" })];
    expect(filterByAssignee(ops, "alice")).toHaveLength(1);
  });

  it("returns empty when no match", () => {
    expect(filterByAssignee([makeOp({ assignedTo: "alice" })], "bob")).toHaveLength(0);
  });
});
