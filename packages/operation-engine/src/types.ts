// ─── Operation Status ─────────────────────────────────────────────────────────

export type OperationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "failed";

export type OperationEventType =
  | "operation.created"
  | "operation.submitted"
  | "operation.approved"
  | "operation.rejected"
  | "operation.scheduled"
  | "operation.started"
  | "operation.completed"
  | "operation.cancelled"
  | "operation.failed"
  | "operation.resource_assigned"
  | "operation.resource_released";

// ─── Operation ────────────────────────────────────────────────────────────────

export interface Operation {
  id: string;
  tenantId: string;
  branchId: string;
  type: string;
  blueprintId: string | null;
  contractId: string | null;
  status: OperationStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  assignedResourceIds: string[];
  assignedOperatorIds: string[];
  workflowInstanceId: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Operation Event ──────────────────────────────────────────────────────────

export interface OperationEvent {
  id: string;
  operationId: string;
  tenantId: string;
  type: OperationEventType;
  actorId: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

// ─── Assignment ───────────────────────────────────────────────────────────────

export interface OperationAssignment {
  operationId: string;
  resourceId: string;
  operatorId: string | null;
  allocationId: string | null;
  assignedAt: string;
  assignedBy: string;
}

// ─── Repository Interfaces ────────────────────────────────────────────────────

export interface OperationRepository {
  findById(id: string): Promise<Operation | null>;
  findByTenant(tenantId: string): Promise<Operation[]>;
  findByStatus(tenantId: string, status: OperationStatus): Promise<Operation[]>;
  findByBranch(tenantId: string, branchId: string): Promise<Operation[]>;
  save(operation: Operation): Promise<Operation>;
  update(operation: Operation): Promise<Operation>;
}

export interface OperationEventRepository {
  findByOperation(operationId: string): Promise<OperationEvent[]>;
  save(event: OperationEvent): Promise<OperationEvent>;
}

// ─── Integration Ports ────────────────────────────────────────────────────────

export interface WorkflowPort {
  startWorkflow(
    definitionId: string,
    entityId: string,
    entityType: string,
    createdBy: string,
  ): Promise<string>;
  processEvent(
    instanceId: string,
    trigger: string,
    actorId: string,
  ): Promise<{ success: boolean; reason?: string }>;
}

export interface RulePort {
  evaluate(
    tenantId: string,
    eventType: string,
    entityId: string,
    data: Record<string, unknown>,
  ): Promise<{ blocked: boolean; blockReason?: string }>;
}

export interface ResourcePort {
  allocate(
    operationId: string,
    tenantId: string,
    resourceId: string,
    startAt: string,
    endAt: string,
    allocatedBy: string,
  ): Promise<string>;
  deallocate(allocationId: string, deallocatedBy: string): Promise<void>;
}
