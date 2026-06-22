// ─── State Definitions ───────────────────────────────────────────────────────

export type WorkflowStateType = "initial" | "intermediate" | "final";

export interface WorkflowStateDefinition {
  key: string;
  name: string;
  type: WorkflowStateType;
  metadata: Record<string, unknown>;
}

// ─── Transition Definitions ───────────────────────────────────────────────────

export interface TransitionCondition {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "exists";
  value: unknown;
}

export interface WorkflowTransitionDefinition {
  id: string;
  fromState: string;
  toState: string;
  trigger: string;
  conditions: TransitionCondition[];
  actions: string[];
}

// ─── Workflow Definition ──────────────────────────────────────────────────────

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  tenantId: string | null;
  currentVersion: number;
  states: WorkflowStateDefinition[];
  transitions: WorkflowTransitionDefinition[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Versioning ───────────────────────────────────────────────────────────────

export interface WorkflowVersion {
  id: string;
  definitionId: string;
  version: number;
  snapshot: WorkflowDefinition;
  changelog: string;
  publishedBy: string;
  publishedAt: string;
}

// ─── Instance ─────────────────────────────────────────────────────────────────

export type WorkflowInstanceStatus = "active" | "completed" | "cancelled" | "failed";

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  definitionVersion: number;
  currentState: string;
  entityId: string;
  entityType: string;
  status: WorkflowInstanceStatus;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface WorkflowHistoryEntry {
  id: string;
  instanceId: string;
  fromState: string | null;
  toState: string;
  trigger: string;
  transitionId: string | null;
  actorId: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

// ─── Runtime Results ──────────────────────────────────────────────────────────

export interface TransitionResult {
  success: boolean;
  previousState: string;
  newState: string;
  trigger: string;
  historyEntry: WorkflowHistoryEntry;
  actionsTriggered: string[];
  reason?: string;
}

export interface StartWorkflowResult {
  instance: WorkflowInstance;
  historyEntry: WorkflowHistoryEntry;
}

// ─── Repository Interfaces ────────────────────────────────────────────────────

export interface WorkflowDefinitionRepository {
  findById(id: string): Promise<WorkflowDefinition | null>;
  save(definition: WorkflowDefinition): Promise<WorkflowDefinition>;
  update(definition: WorkflowDefinition): Promise<WorkflowDefinition>;
}

export interface WorkflowVersionRepository {
  findByDefinitionId(definitionId: string): Promise<WorkflowVersion[]>;
  findByDefinitionAndVersion(
    definitionId: string,
    version: number,
  ): Promise<WorkflowVersion | null>;
  save(version: WorkflowVersion): Promise<WorkflowVersion>;
}

export interface WorkflowInstanceRepository {
  findById(id: string): Promise<WorkflowInstance | null>;
  findByEntity(entityType: string, entityId: string): Promise<WorkflowInstance[]>;
  findActiveByEntity(entityType: string, entityId: string): Promise<WorkflowInstance | null>;
  save(instance: WorkflowInstance): Promise<WorkflowInstance>;
  update(instance: WorkflowInstance): Promise<WorkflowInstance>;
}

export interface WorkflowHistoryRepository {
  findByInstanceId(instanceId: string): Promise<WorkflowHistoryEntry[]>;
  save(entry: WorkflowHistoryEntry): Promise<WorkflowHistoryEntry>;
}
