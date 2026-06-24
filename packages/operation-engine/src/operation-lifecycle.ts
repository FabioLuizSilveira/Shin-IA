import type {
  Operation,
  OperationStatus,
  OperationEvent,
  OperationEventType,
  OperationRepository,
  OperationEventRepository,
  WorkflowPort,
  RulePort,
} from "./types.js";

// Valid status transitions
const TRANSITIONS: Record<OperationStatus, OperationStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "cancelled"],
  approved: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled", "failed"],
  completed: [],
  cancelled: [],
  failed: [],
};

export interface OperationLifecycleDeps {
  operationRepository: OperationRepository;
  eventRepository: OperationEventRepository;
  workflowPort?: WorkflowPort;
  rulePort?: RulePort;
}

export interface CreateOperationInput {
  tenantId: string;
  branchId: string;
  type: string;
  blueprintId?: string;
  contractId?: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  workflowDefinitionId?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
}

export interface TransitionInput {
  operationId: string;
  toStatus: OperationStatus;
  actorId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface CancelInput {
  operationId: string;
  actorId: string;
  reason: string;
}

export class OperationLifecycle {
  private ops: OperationRepository;
  private events: OperationEventRepository;
  private workflow?: WorkflowPort;
  private rules?: RulePort;

  constructor(deps: OperationLifecycleDeps) {
    this.ops = deps.operationRepository;
    this.events = deps.eventRepository;
    this.workflow = deps.workflowPort;
    this.rules = deps.rulePort;
  }

  async create(input: CreateOperationInput): Promise<Operation> {
    const now = new Date().toISOString();

    if (this.rules) {
      const check = await this.rules.evaluate(input.tenantId, "operation.create", "new", {
        type: input.type,
        blueprintId: input.blueprintId,
      });
      if (check.blocked) {
        throw new Error(`Operation creation blocked by rule: ${check.blockReason}`);
      }
    }

    const operation: Operation = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      type: input.type,
      blueprintId: input.blueprintId ?? null,
      contractId: input.contractId ?? null,
      status: "draft",
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      actualStartAt: null,
      actualEndAt: null,
      assignedResourceIds: [],
      assignedOperatorIds: [],
      workflowInstanceId: null,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    let workflowInstanceId: string | null = null;
    if (this.workflow && input.workflowDefinitionId) {
      workflowInstanceId = await this.workflow.startWorkflow(
        input.workflowDefinitionId,
        operation.id,
        "operation",
        input.createdBy,
      );
    }

    const saved = await this.ops.save({ ...operation, workflowInstanceId });
    await this.emitEvent(saved, "operation.created", input.createdBy, {});
    return saved;
  }

  async transition(input: TransitionInput): Promise<Operation> {
    const operation = await this.requireOperation(input.operationId);

    const allowed = TRANSITIONS[operation.status] ?? [];
    if (!allowed.includes(input.toStatus)) {
      throw new Error(`Cannot transition from '${operation.status}' to '${input.toStatus}'`);
    }

    const now = new Date().toISOString();
    const eventType = this.statusToEventType(input.toStatus);

    const patch: Partial<Operation> = {
      status: input.toStatus,
      updatedAt: now,
    };

    if (input.toStatus === "in_progress") patch.actualStartAt = now;
    if (
      input.toStatus === "completed" ||
      input.toStatus === "cancelled" ||
      input.toStatus === "failed"
    ) {
      patch.actualEndAt = now;
    }

    if (this.workflow && operation.workflowInstanceId) {
      const trigger = this.statusToWorkflowTrigger(input.toStatus);
      if (trigger) {
        const result = await this.workflow.processEvent(
          operation.workflowInstanceId,
          trigger,
          input.actorId,
        );
        if (!result.success) {
          throw new Error(`Workflow rejected transition: ${result.reason}`);
        }
      }
    }

    const updated = await this.ops.update({ ...operation, ...patch });
    await this.emitEvent(updated, eventType, input.actorId, {
      reason: input.reason,
      ...input.metadata,
    });
    return updated;
  }

  async cancel(input: CancelInput): Promise<Operation> {
    return this.transition({
      operationId: input.operationId,
      toStatus: "cancelled",
      actorId: input.actorId,
      reason: input.reason,
    });
  }

  async getHistory(operationId: string): Promise<OperationEvent[]> {
    return this.events.findByOperation(operationId);
  }

  canTransitionTo(current: OperationStatus, target: OperationStatus): boolean {
    return (TRANSITIONS[current] ?? []).includes(target);
  }

  private async requireOperation(id: string): Promise<Operation> {
    const op = await this.ops.findById(id);
    if (!op) throw new Error(`Operation '${id}' not found`);
    return op;
  }

  private async emitEvent(
    operation: Operation,
    type: OperationEventType,
    actorId: string,
    data: Record<string, unknown>,
  ): Promise<OperationEvent> {
    return this.events.save({
      id: crypto.randomUUID(),
      operationId: operation.id,
      tenantId: operation.tenantId,
      type,
      actorId,
      occurredAt: new Date().toISOString(),
      data,
    });
  }

  private statusToEventType(status: OperationStatus): OperationEventType {
    const map: Record<OperationStatus, OperationEventType> = {
      draft: "operation.created",
      pending_approval: "operation.submitted",
      approved: "operation.approved",
      scheduled: "operation.scheduled",
      in_progress: "operation.started",
      completed: "operation.completed",
      cancelled: "operation.cancelled",
      failed: "operation.failed",
    };
    return map[status];
  }

  private statusToWorkflowTrigger(status: OperationStatus): string | null {
    const map: Partial<Record<OperationStatus, string>> = {
      pending_approval: "submit",
      approved: "approve",
      in_progress: "start",
      completed: "complete",
      cancelled: "cancel",
      failed: "fail",
    };
    return map[status] ?? null;
  }
}
