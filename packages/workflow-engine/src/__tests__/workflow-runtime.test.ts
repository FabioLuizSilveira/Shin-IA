import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowRuntime } from "../workflow-runtime.js";
import { WorkflowVersioningService } from "../versioning.js";
import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowHistoryEntry,
  WorkflowVersion,
  WorkflowDefinitionRepository,
  WorkflowVersionRepository,
  WorkflowInstanceRepository,
  WorkflowHistoryRepository,
} from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const definition: WorkflowDefinition = {
  id: "wf-1",
  name: "Test Workflow",
  description: "Simple test workflow",
  tenantId: "tenant-1",
  currentVersion: 1,
  metadata: {},
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  states: [
    { key: "start", name: "Start", type: "initial", metadata: {} },
    { key: "middle", name: "Middle", type: "intermediate", metadata: {} },
    { key: "done", name: "Done", type: "final", metadata: {} },
  ],
  transitions: [
    {
      id: "t1",
      fromState: "start",
      toState: "middle",
      trigger: "advance",
      conditions: [],
      actions: ["action_a"],
    },
    {
      id: "t2",
      fromState: "middle",
      toState: "done",
      trigger: "finish",
      conditions: [],
      actions: ["action_b"],
    },
  ],
};

const baseInstance: WorkflowInstance = {
  id: "inst-1",
  definitionId: "wf-1",
  definitionVersion: 1,
  currentState: "start",
  entityId: "entity-1",
  entityType: "operation",
  status: "active",
  startedAt: "2026-01-01T00:00:00Z",
  completedAt: null,
  cancelledAt: null,
  metadata: {},
  createdBy: "user-1",
};

// ─── Mock Factories ───────────────────────────────────────────────────────────

function makeDefinitionRepo(
  def: WorkflowDefinition | null = definition,
): WorkflowDefinitionRepository {
  return {
    findById: vi.fn().mockResolvedValue(def),
    save: vi.fn().mockImplementation((d: WorkflowDefinition) => Promise.resolve(d)),
    update: vi.fn().mockImplementation((d: WorkflowDefinition) => Promise.resolve(d)),
  };
}

function makeInstanceRepo(
  instance: WorkflowInstance | null = baseInstance,
): WorkflowInstanceRepository {
  return {
    findById: vi.fn().mockResolvedValue(instance),
    findByEntity: vi.fn().mockResolvedValue([]),
    findActiveByEntity: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation((i: WorkflowInstance) => Promise.resolve(i)),
    update: vi.fn().mockImplementation((i: WorkflowInstance) => Promise.resolve(i)),
  };
}

function makeHistoryRepo(): WorkflowHistoryRepository {
  return {
    findByInstanceId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((e: WorkflowHistoryEntry) => Promise.resolve(e)),
  };
}

function makeVersionRepo(): WorkflowVersionRepository {
  return {
    findByDefinitionId: vi.fn().mockResolvedValue([]),
    findByDefinitionAndVersion: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation((v: WorkflowVersion) => Promise.resolve(v)),
  };
}

// ─── WorkflowRuntime Tests ────────────────────────────────────────────────────

describe("WorkflowRuntime", () => {
  let runtime: WorkflowRuntime;
  let defRepo: WorkflowDefinitionRepository;
  let instRepo: WorkflowInstanceRepository;
  let histRepo: WorkflowHistoryRepository;

  beforeEach(() => {
    defRepo = makeDefinitionRepo();
    instRepo = makeInstanceRepo();
    histRepo = makeHistoryRepo();
    runtime = new WorkflowRuntime({
      definitionRepository: defRepo,
      instanceRepository: instRepo,
      historyRepository: histRepo,
    });
  });

  describe("startWorkflow", () => {
    it("creates instance in initial state", async () => {
      const result = await runtime.startWorkflow({
        definitionId: "wf-1",
        entityId: "op-1",
        entityType: "operation",
        createdBy: "user-1",
      });

      expect(result.instance.currentState).toBe("start");
      expect(result.instance.status).toBe("active");
      expect(result.historyEntry.fromState).toBeNull();
      expect(result.historyEntry.toState).toBe("start");
      expect(result.historyEntry.trigger).toBe("workflow.started");
    });

    it("throws when definition not found", async () => {
      defRepo = makeDefinitionRepo(null);
      runtime = new WorkflowRuntime({
        definitionRepository: defRepo,
        instanceRepository: instRepo,
        historyRepository: histRepo,
      });
      await expect(
        runtime.startWorkflow({
          definitionId: "missing",
          entityId: "x",
          entityType: "y",
          createdBy: "z",
        }),
      ).rejects.toThrow("not found");
    });

    it("throws when definition has no initial state", async () => {
      const badDef = {
        ...definition,
        states: definition.states.filter((s) => s.type !== "initial"),
      };
      defRepo = makeDefinitionRepo(badDef);
      runtime = new WorkflowRuntime({
        definitionRepository: defRepo,
        instanceRepository: instRepo,
        historyRepository: histRepo,
      });
      await expect(
        runtime.startWorkflow({
          definitionId: "wf-1",
          entityId: "x",
          entityType: "y",
          createdBy: "z",
        }),
      ).rejects.toThrow("no initial state");
    });

    it("throws for invalid workflow definition (no final state)", async () => {
      const badDef = { ...definition, states: definition.states.filter((s) => s.type !== "final") };
      defRepo = makeDefinitionRepo(badDef);
      runtime = new WorkflowRuntime({
        definitionRepository: defRepo,
        instanceRepository: instRepo,
        historyRepository: histRepo,
      });
      await expect(
        runtime.startWorkflow({
          definitionId: "wf-1",
          entityId: "x",
          entityType: "y",
          createdBy: "z",
        }),
      ).rejects.toThrow("Invalid workflow");
    });

    it("includes metadata in instance", async () => {
      const result = await runtime.startWorkflow({
        definitionId: "wf-1",
        entityId: "op-1",
        entityType: "operation",
        createdBy: "user-1",
        metadata: { priority: "high" },
      });
      expect(result.instance.metadata).toEqual({ priority: "high" });
    });
  });

  describe("processEvent", () => {
    it("transitions successfully on valid trigger", async () => {
      const result = await runtime.processEvent({
        instanceId: "inst-1",
        trigger: "advance",
        actorId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.previousState).toBe("start");
      expect(result.newState).toBe("middle");
      expect(result.actionsTriggered).toContain("action_a");
    });

    it("returns failure result when transition not allowed", async () => {
      const result = await runtime.processEvent({
        instanceId: "inst-1",
        trigger: "finish", // not valid from "start"
        actorId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.newState).toBe("start");
      expect(result.reason).toBeDefined();
    });

    it("throws when instance not found", async () => {
      instRepo = makeInstanceRepo(null);
      runtime = new WorkflowRuntime({
        definitionRepository: defRepo,
        instanceRepository: instRepo,
        historyRepository: histRepo,
      });
      await expect(
        runtime.processEvent({ instanceId: "missing", trigger: "advance", actorId: "u" }),
      ).rejects.toThrow("not found");
    });

    it("transitions to final state marks as completed", async () => {
      const middleInstance = { ...baseInstance, currentState: "middle" };
      instRepo = makeInstanceRepo(middleInstance);
      runtime = new WorkflowRuntime({
        definitionRepository: defRepo,
        instanceRepository: instRepo,
        historyRepository: histRepo,
      });

      const result = await runtime.processEvent({
        instanceId: "inst-1",
        trigger: "finish",
        actorId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.newState).toBe("done");
      expect(instRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed", completedAt: expect.any(String) }),
      );
    });

    it("records history entry with metadata", async () => {
      await runtime.processEvent({
        instanceId: "inst-1",
        trigger: "advance",
        actorId: "user-1",
        metadata: { source: "api" },
      });

      expect(histRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { source: "api" } }),
      );
    });
  });

  describe("cancelWorkflow", () => {
    it("cancels an active workflow", async () => {
      await runtime.cancelWorkflow({
        instanceId: "inst-1",
        cancelledBy: "user-1",
        reason: "Test cancellation",
      });

      expect(instRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled", cancelledAt: expect.any(String) }),
      );
      expect(histRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: "workflow.cancelled",
          metadata: { reason: "Test cancellation" },
        }),
      );
    });

    it("throws when cancelling a non-active workflow", async () => {
      instRepo = makeInstanceRepo({ ...baseInstance, status: "completed" });
      runtime = new WorkflowRuntime({
        definitionRepository: defRepo,
        instanceRepository: instRepo,
        historyRepository: histRepo,
      });
      await expect(
        runtime.cancelWorkflow({ instanceId: "inst-1", cancelledBy: "u", reason: "x" }),
      ).rejects.toThrow("Cannot cancel");
    });
  });

  describe("getHistory", () => {
    it("delegates to history repository", async () => {
      await runtime.getHistory("inst-1");
      expect(histRepo.findByInstanceId).toHaveBeenCalledWith("inst-1");
    });
  });

  describe("getInstance", () => {
    it("returns instance by id", async () => {
      const result = await runtime.getInstance("inst-1");
      expect(result?.id).toBe("inst-1");
    });
  });
});

// ─── WorkflowVersioningService Tests ─────────────────────────────────────────

describe("WorkflowVersioningService", () => {
  let defRepo: WorkflowDefinitionRepository;
  let versionRepo: WorkflowVersionRepository;
  let service: WorkflowVersioningService;

  beforeEach(() => {
    defRepo = makeDefinitionRepo();
    versionRepo = makeVersionRepo();
    service = new WorkflowVersioningService({
      definitionRepository: defRepo,
      versionRepository: versionRepo,
    });
  });

  it("publishes a new version and bumps currentVersion", async () => {
    const version = await service.publishVersion("wf-1", "Initial release", "user-1");
    expect(version.version).toBe(2); // currentVersion was 1
    expect(version.changelog).toBe("Initial release");
    expect(version.publishedBy).toBe("user-1");
    expect(defRepo.update).toHaveBeenCalledWith(expect.objectContaining({ currentVersion: 2 }));
  });

  it("throws when definition not found", async () => {
    defRepo = makeDefinitionRepo(null);
    service = new WorkflowVersioningService({
      definitionRepository: defRepo,
      versionRepository: versionRepo,
    });
    await expect(service.publishVersion("missing", "x", "y")).rejects.toThrow("not found");
  });

  it("retrieves version history", async () => {
    await service.getVersionHistory("wf-1");
    expect(versionRepo.findByDefinitionId).toHaveBeenCalledWith("wf-1");
  });

  it("retrieves specific version", async () => {
    await service.getVersion("wf-1", 1);
    expect(versionRepo.findByDefinitionAndVersion).toHaveBeenCalledWith("wf-1", 1);
  });

  it("rolls back to a previous version", async () => {
    const v1: WorkflowVersion = {
      id: "v1",
      definitionId: "wf-1",
      version: 1,
      snapshot: definition,
      changelog: "Original",
      publishedBy: "user-1",
      publishedAt: "2026-01-01T00:00:00Z",
    };
    versionRepo = { ...versionRepo, findByDefinitionAndVersion: vi.fn().mockResolvedValue(v1) };
    service = new WorkflowVersioningService({
      definitionRepository: defRepo,
      versionRepository: versionRepo,
    });

    const result = await service.rollbackToVersion("wf-1", 1, "user-2");
    expect(result.currentVersion).toBe(2); // bumped
    expect(defRepo.update).toHaveBeenCalled();
    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ changelog: expect.stringContaining("Rollback") }),
    );
  });

  it("throws rollback when version not found", async () => {
    await expect(service.rollbackToVersion("wf-1", 99, "user")).rejects.toThrow(
      "Version 99 not found",
    );
  });
});
