import { describe, it, expect } from "vitest";
import { StateMachine } from "../state-machine.js";
import type { WorkflowDefinition, WorkflowInstance } from "../types.js";

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const rentalWorkflowDef: WorkflowDefinition = {
  id: "wf-rental",
  name: "Vehicle Rental Workflow",
  description: "Lifecycle for vehicle rental operations",
  tenantId: "tenant-1",
  currentVersion: 1,
  metadata: {},
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  states: [
    { key: "draft", name: "Draft", type: "initial", metadata: {} },
    { key: "pending_approval", name: "Pending Approval", type: "intermediate", metadata: {} },
    { key: "approved", name: "Approved", type: "intermediate", metadata: {} },
    { key: "in_progress", name: "In Progress", type: "intermediate", metadata: {} },
    { key: "completed", name: "Completed", type: "final", metadata: {} },
    { key: "cancelled", name: "Cancelled", type: "final", metadata: {} },
  ],
  transitions: [
    {
      id: "t1",
      fromState: "draft",
      toState: "pending_approval",
      trigger: "submit",
      conditions: [],
      actions: ["notify_approver"],
    },
    {
      id: "t2",
      fromState: "pending_approval",
      toState: "approved",
      trigger: "approve",
      conditions: [],
      actions: ["notify_requester"],
    },
    {
      id: "t3",
      fromState: "pending_approval",
      toState: "cancelled",
      trigger: "reject",
      conditions: [],
      actions: ["notify_requester"],
    },
    {
      id: "t4",
      fromState: "approved",
      toState: "in_progress",
      trigger: "start",
      conditions: [],
      actions: ["allocate_resources"],
    },
    {
      id: "t5",
      fromState: "in_progress",
      toState: "completed",
      trigger: "complete",
      conditions: [],
      actions: ["release_resources"],
    },
    {
      id: "t6",
      fromState: "in_progress",
      toState: "cancelled",
      trigger: "cancel",
      conditions: [],
      actions: ["release_resources"],
    },
    {
      id: "t7",
      fromState: "approved",
      toState: "cancelled",
      trigger: "cancel",
      conditions: [{ field: "canCancel", operator: "eq", value: true }],
      actions: [],
    },
  ],
};

const makeInstance = (overrides: Partial<WorkflowInstance> = {}): WorkflowInstance => ({
  id: "instance-1",
  definitionId: "wf-rental",
  definitionVersion: 1,
  currentState: "draft",
  entityId: "op-1",
  entityType: "operation",
  status: "active",
  startedAt: "2026-01-01T00:00:00Z",
  completedAt: null,
  cancelledAt: null,
  metadata: {},
  createdBy: "user-1",
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StateMachine", () => {
  const sm = new StateMachine();

  describe("getInitialState", () => {
    it("returns the initial state", () => {
      const state = sm.getInitialState(rentalWorkflowDef);
      expect(state?.key).toBe("draft");
    });

    it("returns null if no initial state", () => {
      const def = { ...rentalWorkflowDef, states: [] };
      expect(sm.getInitialState(def)).toBeNull();
    });
  });

  describe("getState", () => {
    it("returns state by key", () => {
      expect(sm.getState(rentalWorkflowDef, "approved")?.type).toBe("intermediate");
    });

    it("returns null for unknown key", () => {
      expect(sm.getState(rentalWorkflowDef, "nonexistent")).toBeNull();
    });
  });

  describe("isInFinalState", () => {
    it("returns false for intermediate state", () => {
      const instance = makeInstance({ currentState: "in_progress" });
      expect(sm.isInFinalState(rentalWorkflowDef, instance)).toBe(false);
    });

    it("returns true for final state", () => {
      const instance = makeInstance({ currentState: "completed" });
      expect(sm.isInFinalState(rentalWorkflowDef, instance)).toBe(true);
    });

    it("returns true for cancelled final state", () => {
      const instance = makeInstance({ currentState: "cancelled" });
      expect(sm.isInFinalState(rentalWorkflowDef, instance)).toBe(true);
    });
  });

  describe("getAvailableTransitions", () => {
    it("returns transitions from current state", () => {
      const instance = makeInstance({ currentState: "draft" });
      const transitions = sm.getAvailableTransitions(rentalWorkflowDef, instance);
      expect(transitions).toHaveLength(1);
      expect(transitions[0]?.trigger).toBe("submit");
    });

    it("returns empty for final state", () => {
      const instance = makeInstance({ currentState: "completed" });
      const transitions = sm.getAvailableTransitions(rentalWorkflowDef, instance);
      expect(transitions).toHaveLength(0);
    });

    it("filters based on conditions", () => {
      const instance = makeInstance({ currentState: "approved" });
      // t4=start (no conditions), t7=cancel (requires canCancel=true)
      const withoutCancel = sm.getAvailableTransitions(rentalWorkflowDef, instance, {
        canCancel: false,
      });
      expect(withoutCancel).toHaveLength(1); // only t4 (start)

      const withCancel = sm.getAvailableTransitions(rentalWorkflowDef, instance, {
        canCancel: true,
      });
      expect(withCancel).toHaveLength(2); // t4 (start) + t7 (cancel)
    });
  });

  describe("canTransition", () => {
    it("allows valid transition", () => {
      const instance = makeInstance({ currentState: "draft" });
      const result = sm.canTransition(rentalWorkflowDef, instance, "submit");
      expect(result.allowed).toBe(true);
      expect(result.transition?.id).toBe("t1");
    });

    it("denies when no matching trigger", () => {
      const instance = makeInstance({ currentState: "draft" });
      const result = sm.canTransition(rentalWorkflowDef, instance, "approve");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("No valid transition");
    });

    it("denies when instance is not active", () => {
      const instance = makeInstance({ status: "completed" });
      const result = sm.canTransition(rentalWorkflowDef, instance, "submit");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("completed");
    });

    it("denies from final state", () => {
      const instance = makeInstance({ currentState: "completed", status: "completed" });
      const result = sm.canTransition(rentalWorkflowDef, instance, "complete");
      expect(result.allowed).toBe(false);
    });

    it("respects condition context", () => {
      const instance = makeInstance({ currentState: "approved" });
      const resultWithout = sm.canTransition(rentalWorkflowDef, instance, "cancel", {
        canCancel: false,
      });
      const resultWith = sm.canTransition(rentalWorkflowDef, instance, "cancel", {
        canCancel: true,
      });
      expect(resultWithout.allowed).toBe(false);
      expect(resultWith.allowed).toBe(true);
    });
  });

  describe("applyTransition", () => {
    it("moves instance to the new state", () => {
      const instance = makeInstance({ currentState: "draft" });
      const transition = rentalWorkflowDef.transitions.find((t) => t.id === "t1")!;
      const updated = sm.applyTransition(rentalWorkflowDef, instance, transition);
      expect(updated.currentState).toBe("pending_approval");
      expect(updated.status).toBe("active");
    });

    it("marks instance as completed when entering final state", () => {
      const instance = makeInstance({ currentState: "in_progress" });
      const transition = rentalWorkflowDef.transitions.find((t) => t.id === "t5")!;
      const updated = sm.applyTransition(rentalWorkflowDef, instance, transition);
      expect(updated.currentState).toBe("completed");
      expect(updated.status).toBe("completed");
      expect(updated.completedAt).toBeTruthy();
    });
  });

  describe("validate", () => {
    it("returns no errors for valid definition", () => {
      expect(sm.validate(rentalWorkflowDef)).toHaveLength(0);
    });

    it("detects missing initial state", () => {
      const def = {
        ...rentalWorkflowDef,
        states: rentalWorkflowDef.states.filter((s) => s.type !== "initial"),
      };
      const errors = sm.validate(def);
      expect(errors.some((e) => e.includes("initial"))).toBe(true);
    });

    it("detects missing final state", () => {
      const def = {
        ...rentalWorkflowDef,
        states: rentalWorkflowDef.states.filter((s) => s.type !== "final"),
      };
      const errors = sm.validate(def);
      expect(errors.some((e) => e.includes("final"))).toBe(true);
    });

    it("detects unknown fromState in transition", () => {
      const def = {
        ...rentalWorkflowDef,
        transitions: [
          ...rentalWorkflowDef.transitions,
          {
            id: "bad",
            fromState: "nonexistent",
            toState: "completed",
            trigger: "x",
            conditions: [],
            actions: [],
          },
        ],
      };
      const errors = sm.validate(def);
      expect(errors.some((e) => e.includes("nonexistent"))).toBe(true);
    });

    it("detects unknown toState in transition", () => {
      const def = {
        ...rentalWorkflowDef,
        transitions: [
          ...rentalWorkflowDef.transitions,
          {
            id: "bad2",
            fromState: "draft",
            toState: "ghost",
            trigger: "x",
            conditions: [],
            actions: [],
          },
        ],
      };
      const errors = sm.validate(def);
      expect(errors.some((e) => e.includes("ghost"))).toBe(true);
    });
  });

  describe("condition operators", () => {
    const defWithConditions: WorkflowDefinition = {
      ...rentalWorkflowDef,
      transitions: [
        {
          id: "c-ne",
          fromState: "draft",
          toState: "pending_approval",
          trigger: "ne-test",
          conditions: [{ field: "status", operator: "ne", value: "blocked" }],
          actions: [],
        },
        {
          id: "c-gt",
          fromState: "draft",
          toState: "pending_approval",
          trigger: "gt-test",
          conditions: [{ field: "count", operator: "gt", value: 5 }],
          actions: [],
        },
        {
          id: "c-gte",
          fromState: "draft",
          toState: "pending_approval",
          trigger: "gte-test",
          conditions: [{ field: "count", operator: "gte", value: 5 }],
          actions: [],
        },
        {
          id: "c-lt",
          fromState: "draft",
          toState: "pending_approval",
          trigger: "lt-test",
          conditions: [{ field: "count", operator: "lt", value: 5 }],
          actions: [],
        },
        {
          id: "c-lte",
          fromState: "draft",
          toState: "pending_approval",
          trigger: "lte-test",
          conditions: [{ field: "count", operator: "lte", value: 5 }],
          actions: [],
        },
        {
          id: "c-in",
          fromState: "draft",
          toState: "pending_approval",
          trigger: "in-test",
          conditions: [{ field: "role", operator: "in", value: ["admin", "manager"] }],
          actions: [],
        },
        {
          id: "c-exists",
          fromState: "draft",
          toState: "pending_approval",
          trigger: "exists-test",
          conditions: [{ field: "ownerId", operator: "exists", value: null }],
          actions: [],
        },
        {
          id: "c-nested",
          fromState: "draft",
          toState: "pending_approval",
          trigger: "nested-test",
          conditions: [{ field: "user.role", operator: "eq", value: "admin" }],
          actions: [],
        },
      ],
    };

    const instance = makeInstance({ currentState: "draft" });

    it("ne operator", () => {
      expect(
        sm.canTransition(defWithConditions, instance, "ne-test", { status: "active" }).allowed,
      ).toBe(true);
      expect(
        sm.canTransition(defWithConditions, instance, "ne-test", { status: "blocked" }).allowed,
      ).toBe(false);
    });

    it("gt/gte/lt/lte operators", () => {
      expect(sm.canTransition(defWithConditions, instance, "gt-test", { count: 6 }).allowed).toBe(
        true,
      );
      expect(sm.canTransition(defWithConditions, instance, "gt-test", { count: 5 }).allowed).toBe(
        false,
      );
      expect(sm.canTransition(defWithConditions, instance, "gte-test", { count: 5 }).allowed).toBe(
        true,
      );
      expect(sm.canTransition(defWithConditions, instance, "lt-test", { count: 4 }).allowed).toBe(
        true,
      );
      expect(sm.canTransition(defWithConditions, instance, "lte-test", { count: 5 }).allowed).toBe(
        true,
      );
    });

    it("in operator", () => {
      expect(
        sm.canTransition(defWithConditions, instance, "in-test", { role: "admin" }).allowed,
      ).toBe(true);
      expect(
        sm.canTransition(defWithConditions, instance, "in-test", { role: "viewer" }).allowed,
      ).toBe(false);
    });

    it("exists operator", () => {
      expect(
        sm.canTransition(defWithConditions, instance, "exists-test", { ownerId: "x" }).allowed,
      ).toBe(true);
      expect(
        sm.canTransition(defWithConditions, instance, "exists-test", { ownerId: null }).allowed,
      ).toBe(false);
    });

    it("nested field access", () => {
      expect(
        sm.canTransition(defWithConditions, instance, "nested-test", { user: { role: "admin" } })
          .allowed,
      ).toBe(true);
      expect(
        sm.canTransition(defWithConditions, instance, "nested-test", { user: { role: "viewer" } })
          .allowed,
      ).toBe(false);
    });
  });
});
