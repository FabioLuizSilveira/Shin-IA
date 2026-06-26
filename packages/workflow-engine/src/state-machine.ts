import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowTransitionDefinition,
  WorkflowStateDefinition,
  TransitionCondition,
} from "./types.js";

function evaluateCondition(
  condition: TransitionCondition,
  context: Record<string, unknown>,
): boolean {
  const value = getNestedValue(context, condition.field);

  switch (condition.operator) {
    case "eq":
      return value === condition.value;
    case "ne":
      return value !== condition.value;
    case "gt":
      return (
        typeof value === "number" && typeof condition.value === "number" && value > condition.value
      );
    case "gte":
      return (
        typeof value === "number" && typeof condition.value === "number" && value >= condition.value
      );
    case "lt":
      return (
        typeof value === "number" && typeof condition.value === "number" && value < condition.value
      );
    case "lte":
      return (
        typeof value === "number" && typeof condition.value === "number" && value <= condition.value
      );
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(value);
    case "exists":
      return value !== undefined && value !== null;
    default:
      return false;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export class StateMachine {
  getInitialState(definition: WorkflowDefinition): WorkflowStateDefinition | null {
    return definition.states.find((s) => s.type === "initial") ?? null;
  }

  getState(definition: WorkflowDefinition, key: string): WorkflowStateDefinition | null {
    return definition.states.find((s) => s.key === key) ?? null;
  }

  isInFinalState(definition: WorkflowDefinition, instance: WorkflowInstance): boolean {
    const state = this.getState(definition, instance.currentState);
    return state?.type === "final";
  }

  getAvailableTransitions(
    definition: WorkflowDefinition,
    instance: WorkflowInstance,
    context: Record<string, unknown> = {},
  ): WorkflowTransitionDefinition[] {
    return definition.transitions.filter((t) => {
      if (t.fromState !== instance.currentState) return false;
      return t.conditions.every((c) => evaluateCondition(c, context));
    });
  }

  canTransition(
    definition: WorkflowDefinition,
    instance: WorkflowInstance,
    trigger: string,
    context: Record<string, unknown> = {},
  ): { allowed: boolean; transition: WorkflowTransitionDefinition | null; reason?: string } {
    if (instance.status !== "active") {
      return {
        allowed: false,
        transition: null,
        reason: `Workflow instance is ${instance.status}`,
      };
    }

    if (this.isInFinalState(definition, instance)) {
      return {
        allowed: false,
        transition: null,
        reason: `Instance is in a final state: ${instance.currentState}`,
      };
    }

    const matchingTransitions = definition.transitions.filter(
      (t) =>
        t.fromState === instance.currentState &&
        t.trigger === trigger &&
        t.conditions.every((c) => evaluateCondition(c, context)),
    );

    if (matchingTransitions.length === 0) {
      return {
        allowed: false,
        transition: null,
        reason: `No valid transition found from '${instance.currentState}' with trigger '${trigger}'`,
      };
    }

    return { allowed: true, transition: matchingTransitions[0]! };
  }

  applyTransition(
    definition: WorkflowDefinition,
    instance: WorkflowInstance,
    transition: WorkflowTransitionDefinition,
  ): WorkflowInstance {
    const toState = this.getState(definition, transition.toState);
    const isFinal = toState?.type === "final";
    const now = new Date().toISOString();

    return {
      ...instance,
      currentState: transition.toState,
      status: isFinal ? "completed" : "active",
      completedAt: isFinal ? now : instance.completedAt,
    };
  }

  validate(definition: WorkflowDefinition): string[] {
    const errors: string[] = [];
    const stateKeys = new Set(definition.states.map((s) => s.key));

    const initialStates = definition.states.filter((s) => s.type === "initial");
    if (initialStates.length === 0) errors.push("Workflow must have exactly one initial state");
    if (initialStates.length > 1) errors.push("Workflow must have at most one initial state");

    const finalStates = definition.states.filter((s) => s.type === "final");
    if (finalStates.length === 0) errors.push("Workflow must have at least one final state");

    for (const transition of definition.transitions) {
      if (!stateKeys.has(transition.fromState)) {
        errors.push(
          `Transition '${transition.id}' references unknown fromState '${transition.fromState}'`,
        );
      }
      if (!stateKeys.has(transition.toState)) {
        errors.push(
          `Transition '${transition.id}' references unknown toState '${transition.toState}'`,
        );
      }
    }

    return errors;
  }
}
