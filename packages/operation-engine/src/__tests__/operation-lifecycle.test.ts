import { describe, it, expect, vi, beforeEach } from "vitest";
import { OperationLifecycle } from "../operation-lifecycle.js";
import type {
  Operation,
  OperationEvent,
  OperationRepository,
  OperationEventRepository,
  WorkflowPort,
  RulePort,
} from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = "2026-01-01T08:00:00Z";
const start = "2026-01-02T08:00:00Z";
const end = "2026-01-02T18:00:00Z";

const makeOperation = (overrides: Partial<Operation> = {}): Operation => ({
  id: "op-1",
  tenantId: "tenant-1",
  branchId: "branch-1",
  type: "forklift_rental",
  blueprintId: null,
  contractId: "contract-1",
  status: "draft",
  scheduledStartAt: start,
  scheduledEndAt: end,
  actualStartAt: null,
  actualEndAt: null,
  assignedResourceIds: [],
  assignedOperatorIds: [],
  workflowInstanceId: null,
  metadata: {},
  createdBy: "user-1",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

// ─── Mock Repos ───────────────────────────────────────────────────────────────

function makeOpRepo(operation: Operation | null = makeOperation()): OperationRepository {
  return {
    findById: vi.fn().mockResolvedValue(operation),
    findByTenant: vi.fn().mockResolvedValue(operation ? [operation] : []),
    findByStatus: vi.fn().mockResolvedValue([]),
    findByBranch: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((o: Operation) => Promise.resolve(o)),
    update: vi.fn().mockImplementation((o: Operation) => Promise.resolve(o)),
  };
}

function makeEventRepo(): OperationEventRepository {
  return {
    findByOperation: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((e: OperationEvent) => Promise.resolve(e)),
  };
}

function makeWorkflowPort(success = true): WorkflowPort {
  return {
    startWorkflow: vi.fn().mockResolvedValue("wf-instance-1"),
    processEvent: vi
      .fn()
      .mockResolvedValue({ success, reason: success ? undefined : "Workflow rejected" }),
  };
}

function makeRulePort(blocked = false): RulePort {
  return {
    evaluate: vi
      .fn()
      .mockResolvedValue({ blocked, blockReason: blocked ? "Rule blocked" : undefined }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OperationLifecycle", () => {
  let opRepo: OperationRepository;
  let eventRepo: OperationEventRepository;
  let lifecycle: OperationLifecycle;

  beforeEach(() => {
    opRepo = makeOpRepo();
    eventRepo = makeEventRepo();
    lifecycle = new OperationLifecycle({ operationRepository: opRepo, eventRepository: eventRepo });
  });

  describe("create", () => {
    it("creates an operation in draft status", async () => {
      opRepo = makeOpRepo(null);
      opRepo.save = vi.fn().mockImplementation((o: Operation) => Promise.resolve(o));
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
      });

      const op = await lifecycle.create({
        tenantId: "tenant-1",
        branchId: "branch-1",
        type: "crane_rental",
        scheduledStartAt: start,
        scheduledEndAt: end,
        createdBy: "user-1",
      });

      expect(op.status).toBe("draft");
      expect(op.tenantId).toBe("tenant-1");
      expect(op.type).toBe("crane_rental");
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: "operation.created" }),
      );
    });

    it("starts a workflow when workflowDefinitionId is provided", async () => {
      const wfPort = makeWorkflowPort();
      opRepo = makeOpRepo(null);
      opRepo.save = vi.fn().mockImplementation((o: Operation) => Promise.resolve(o));
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
        workflowPort: wfPort,
      });

      const op = await lifecycle.create({
        tenantId: "tenant-1",
        branchId: "branch-1",
        type: "crane_rental",
        scheduledStartAt: start,
        scheduledEndAt: end,
        createdBy: "user-1",
        workflowDefinitionId: "wf-rental",
      });

      expect(wfPort.startWorkflow).toHaveBeenCalledWith(
        "wf-rental",
        expect.any(String),
        "operation",
        "user-1",
      );
      expect(op.workflowInstanceId).toBe("wf-instance-1");
    });

    it("blocks creation when rule engine rejects", async () => {
      const rulePort = makeRulePort(true);
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
        rulePort,
      });

      await expect(
        lifecycle.create({
          tenantId: "tenant-1",
          branchId: "branch-1",
          type: "crane_rental",
          scheduledStartAt: start,
          scheduledEndAt: end,
          createdBy: "user-1",
        }),
      ).rejects.toThrow("blocked by rule");
    });

    it("includes optional fields when provided", async () => {
      opRepo.save = vi.fn().mockImplementation((o: Operation) => Promise.resolve(o));
      const createdOp = await lifecycle.create({
        tenantId: "tenant-1",
        branchId: "branch-1",
        type: "munk_rental",
        scheduledStartAt: start,
        scheduledEndAt: end,
        createdBy: "user-1",
        blueprintId: "bp-1",
        contractId: "contract-2",
        metadata: { priority: "high" },
      });

      expect(createdOp.blueprintId).toBe("bp-1");
      expect(createdOp.contractId).toBe("contract-2");
      expect(createdOp.metadata).toEqual({ priority: "high" });
    });
  });

  describe("transition", () => {
    it("transitions from draft to pending_approval", async () => {
      await lifecycle.transition({
        operationId: "op-1",
        toStatus: "pending_approval",
        actorId: "user-1",
      });

      expect(opRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending_approval" }),
      );
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: "operation.submitted" }),
      );
    });

    it("sets actualStartAt when transitioning to in_progress", async () => {
      opRepo = makeOpRepo(makeOperation({ status: "scheduled" }));
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
      });

      await lifecycle.transition({
        operationId: "op-1",
        toStatus: "in_progress",
        actorId: "user-1",
      });

      expect(opRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ actualStartAt: expect.any(String) }),
      );
    });

    it("sets actualEndAt when completing", async () => {
      opRepo = makeOpRepo(makeOperation({ status: "in_progress" }));
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
      });

      await lifecycle.transition({ operationId: "op-1", toStatus: "completed", actorId: "user-1" });

      expect(opRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ actualEndAt: expect.any(String) }),
      );
    });

    it("throws on invalid transition", async () => {
      await expect(
        lifecycle.transition({ operationId: "op-1", toStatus: "completed", actorId: "user-1" }),
      ).rejects.toThrow("Cannot transition from 'draft' to 'completed'");
    });

    it("throws when operation not found", async () => {
      opRepo = makeOpRepo(null);
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
      });

      await expect(
        lifecycle.transition({
          operationId: "missing",
          toStatus: "pending_approval",
          actorId: "u",
        }),
      ).rejects.toThrow("not found");
    });

    it("propagates workflow event on transition", async () => {
      const wfPort = makeWorkflowPort();
      opRepo = makeOpRepo(makeOperation({ workflowInstanceId: "wf-instance-1" }));
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
        workflowPort: wfPort,
      });

      await lifecycle.transition({
        operationId: "op-1",
        toStatus: "pending_approval",
        actorId: "user-1",
      });

      expect(wfPort.processEvent).toHaveBeenCalledWith("wf-instance-1", "submit", "user-1");
    });

    it("throws when workflow rejects transition", async () => {
      const wfPort = makeWorkflowPort(false);
      opRepo = makeOpRepo(makeOperation({ workflowInstanceId: "wf-instance-1" }));
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
        workflowPort: wfPort,
      });

      await expect(
        lifecycle.transition({
          operationId: "op-1",
          toStatus: "pending_approval",
          actorId: "user-1",
        }),
      ).rejects.toThrow("Workflow rejected");
    });

    it("transitions to failed and sets actualEndAt", async () => {
      opRepo = makeOpRepo(makeOperation({ status: "in_progress" }));
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
      });

      await lifecycle.transition({ operationId: "op-1", toStatus: "failed", actorId: "user-1" });

      expect(opRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", actualEndAt: expect.any(String) }),
      );
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: "operation.failed" }),
      );
    });
  });

  describe("cancel", () => {
    it("cancels an active operation", async () => {
      await lifecycle.cancel({ operationId: "op-1", actorId: "user-1", reason: "Client request" });

      expect(opRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: "operation.cancelled" }),
      );
    });

    it("cannot cancel a completed operation", async () => {
      opRepo = makeOpRepo(makeOperation({ status: "completed" }));
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
      });

      await expect(
        lifecycle.cancel({ operationId: "op-1", actorId: "user-1", reason: "x" }),
      ).rejects.toThrow("Cannot transition");
    });
  });

  describe("getHistory", () => {
    it("returns operation events", async () => {
      await lifecycle.getHistory("op-1");
      expect(eventRepo.findByOperation).toHaveBeenCalledWith("op-1");
    });
  });

  describe("canTransitionTo", () => {
    it("returns true for valid transitions", () => {
      expect(lifecycle.canTransitionTo("draft", "pending_approval")).toBe(true);
      expect(lifecycle.canTransitionTo("in_progress", "completed")).toBe(true);
      expect(lifecycle.canTransitionTo("approved", "scheduled")).toBe(true);
    });

    it("returns false for invalid transitions", () => {
      expect(lifecycle.canTransitionTo("draft", "completed")).toBe(false);
      expect(lifecycle.canTransitionTo("completed", "draft")).toBe(false);
      expect(lifecycle.canTransitionTo("cancelled", "approved")).toBe(false);
    });

    it("returns false from terminal states", () => {
      expect(lifecycle.canTransitionTo("completed", "in_progress")).toBe(false);
      expect(lifecycle.canTransitionTo("failed", "approved")).toBe(false);
    });
  });

  describe("full lifecycle integration", () => {
    it("walks a complete operation lifecycle: draft→approved→in_progress→completed", async () => {
      // Use a stateful mock that tracks the current operation
      let currentOp = makeOperation();
      opRepo = {
        findById: vi.fn().mockImplementation(() => Promise.resolve(currentOp)),
        findByTenant: vi.fn().mockResolvedValue([]),
        findByStatus: vi.fn().mockResolvedValue([]),
        findByBranch: vi.fn().mockResolvedValue([]),
        save: vi.fn().mockImplementation((o: Operation) => {
          currentOp = o;
          return Promise.resolve(o);
        }),
        update: vi.fn().mockImplementation((o: Operation) => {
          currentOp = o;
          return Promise.resolve(o);
        }),
      };
      lifecycle = new OperationLifecycle({
        operationRepository: opRepo,
        eventRepository: eventRepo,
      });

      await lifecycle.transition({
        operationId: "op-1",
        toStatus: "pending_approval",
        actorId: "user-1",
      });
      expect(currentOp.status).toBe("pending_approval");

      await lifecycle.transition({
        operationId: "op-1",
        toStatus: "approved",
        actorId: "approver-1",
      });
      expect(currentOp.status).toBe("approved");

      await lifecycle.transition({ operationId: "op-1", toStatus: "scheduled", actorId: "user-1" });
      await lifecycle.transition({
        operationId: "op-1",
        toStatus: "in_progress",
        actorId: "operator-1",
      });
      expect(currentOp.actualStartAt).toBeTruthy();

      await lifecycle.transition({
        operationId: "op-1",
        toStatus: "completed",
        actorId: "operator-1",
      });
      expect(currentOp.status).toBe("completed");
      expect(currentOp.actualEndAt).toBeTruthy();

      // Verify all events emitted
      expect(eventRepo.save).toHaveBeenCalledTimes(5);
    });
  });
});
