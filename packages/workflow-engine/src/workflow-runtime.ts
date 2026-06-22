import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowHistoryEntry,
  WorkflowInstanceRepository,
  WorkflowHistoryRepository,
  WorkflowDefinitionRepository,
  TransitionResult,
  StartWorkflowResult,
} from "./types.js";
import { StateMachine } from "./state-machine.js";

export interface WorkflowRuntimeDeps {
  definitionRepository: WorkflowDefinitionRepository;
  instanceRepository: WorkflowInstanceRepository;
  historyRepository: WorkflowHistoryRepository;
}

export interface StartWorkflowInput {
  definitionId: string;
  entityId: string;
  entityType: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessEventInput {
  instanceId: string;
  trigger: string;
  actorId: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CancelWorkflowInput {
  instanceId: string;
  cancelledBy: string;
  reason: string;
}

export class WorkflowRuntime {
  private definitions: WorkflowDefinitionRepository;
  private instances: WorkflowInstanceRepository;
  private history: WorkflowHistoryRepository;
  private stateMachine: StateMachine;

  constructor(deps: WorkflowRuntimeDeps) {
    this.definitions = deps.definitionRepository;
    this.instances = deps.instanceRepository;
    this.history = deps.historyRepository;
    this.stateMachine = new StateMachine();
  }

  async startWorkflow(input: StartWorkflowInput): Promise<StartWorkflowResult> {
    const definition = await this.requireDefinition(input.definitionId);

    const initialState = this.stateMachine.getInitialState(definition);
    if (!initialState) {
      throw new Error(`Workflow '${definition.id}' has no initial state`);
    }

    const validationErrors = this.stateMachine.validate(definition);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid workflow definition: ${validationErrors.join(", ")}`);
    }

    const now = new Date().toISOString();
    const instance: WorkflowInstance = {
      id: crypto.randomUUID(),
      definitionId: definition.id,
      definitionVersion: definition.currentVersion,
      currentState: initialState.key,
      entityId: input.entityId,
      entityType: input.entityType,
      status: "active",
      startedAt: now,
      completedAt: null,
      cancelledAt: null,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
    };

    const historyEntry: WorkflowHistoryEntry = {
      id: crypto.randomUUID(),
      instanceId: instance.id,
      fromState: null,
      toState: initialState.key,
      trigger: "workflow.started",
      transitionId: null,
      actorId: input.createdBy,
      occurredAt: now,
      metadata: {},
    };

    const [savedInstance, savedHistory] = await Promise.all([
      this.instances.save(instance),
      this.history.save(historyEntry),
    ]);

    return { instance: savedInstance, historyEntry: savedHistory };
  }

  async processEvent(input: ProcessEventInput): Promise<TransitionResult> {
    const instance = await this.requireInstance(input.instanceId);
    const definition = await this.requireDefinition(instance.definitionId);
    const context = input.context ?? {};

    const { allowed, transition, reason } = this.stateMachine.canTransition(
      definition,
      instance,
      input.trigger,
      context,
    );

    if (!allowed || !transition) {
      return {
        success: false,
        previousState: instance.currentState,
        newState: instance.currentState,
        trigger: input.trigger,
        historyEntry: {
          id: crypto.randomUUID(),
          instanceId: instance.id,
          fromState: instance.currentState,
          toState: instance.currentState,
          trigger: input.trigger,
          transitionId: null,
          actorId: input.actorId,
          occurredAt: new Date().toISOString(),
          metadata: { rejected: true, reason },
        },
        actionsTriggered: [],
        reason,
      };
    }

    const updatedInstance = this.stateMachine.applyTransition(definition, instance, transition);
    const now = new Date().toISOString();

    const historyEntry: WorkflowHistoryEntry = {
      id: crypto.randomUUID(),
      instanceId: instance.id,
      fromState: instance.currentState,
      toState: transition.toState,
      trigger: input.trigger,
      transitionId: transition.id,
      actorId: input.actorId,
      occurredAt: now,
      metadata: input.metadata ?? {},
    };

    await Promise.all([this.instances.update(updatedInstance), this.history.save(historyEntry)]);

    return {
      success: true,
      previousState: instance.currentState,
      newState: transition.toState,
      trigger: input.trigger,
      historyEntry,
      actionsTriggered: transition.actions,
    };
  }

  async cancelWorkflow(input: CancelWorkflowInput): Promise<void> {
    const instance = await this.requireInstance(input.instanceId);
    if (instance.status !== "active") {
      throw new Error(`Cannot cancel workflow in status '${instance.status}'`);
    }

    const now = new Date().toISOString();
    const updated: WorkflowInstance = {
      ...instance,
      status: "cancelled",
      cancelledAt: now,
    };

    const historyEntry: WorkflowHistoryEntry = {
      id: crypto.randomUUID(),
      instanceId: instance.id,
      fromState: instance.currentState,
      toState: instance.currentState,
      trigger: "workflow.cancelled",
      transitionId: null,
      actorId: input.cancelledBy,
      occurredAt: now,
      metadata: { reason: input.reason },
    };

    await Promise.all([this.instances.update(updated), this.history.save(historyEntry)]);
  }

  async getHistory(instanceId: string): Promise<WorkflowHistoryEntry[]> {
    return this.history.findByInstanceId(instanceId);
  }

  async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
    return this.instances.findById(instanceId);
  }

  private async requireDefinition(definitionId: string): Promise<WorkflowDefinition> {
    const definition = await this.definitions.findById(definitionId);
    if (!definition) throw new Error(`WorkflowDefinition '${definitionId}' not found`);
    return definition;
  }

  private async requireInstance(instanceId: string): Promise<WorkflowInstance> {
    const instance = await this.instances.findById(instanceId);
    if (!instance) throw new Error(`WorkflowInstance '${instanceId}' not found`);
    return instance;
  }
}
