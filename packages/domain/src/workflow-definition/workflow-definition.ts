import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import type { TenantId } from "../tenant/tenant.js";
import { WorkflowStatus } from "./workflow-status.enum.js";
import { createEvent } from "../shared/create-event.js";

export type WorkflowDefinitionId = string & { readonly __brand: "WorkflowDefinitionId" };

export interface WorkflowStep {
  stepId: string;
  name: string;
  action: string;
  nextStepId: string | null;
}

export interface CreateWorkflowDefinitionProps {
  id: WorkflowDefinitionId;
  tenantId: TenantId;
  name: string;
  trigger: string;
  steps: WorkflowStep[];
}

interface WorkflowDefinitionState {
  tenantId: TenantId;
  name: string;
  trigger: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkflowDefinition extends AggregateRoot<WorkflowDefinitionId> {
  private _state: WorkflowDefinitionState;

  private constructor(id: WorkflowDefinitionId, state: WorkflowDefinitionState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateWorkflowDefinitionProps): WorkflowDefinition {
    if (!props.name.trim())
      throw new DomainError("WORKFLOW_NAME_REQUIRED", "Workflow name is required.");
    if (props.steps.length === 0)
      throw new DomainError("WORKFLOW_STEPS_REQUIRED", "Workflow must have at least one step.");

    const now = new Date();
    const wf = new WorkflowDefinition(props.id, {
      ...props,
      status: WorkflowStatus.Draft,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    wf.raise(
      createEvent("workflow_definition.created", props.id, "WorkflowDefinition", props.tenantId, {
        name: props.name.trim(),
        trigger: props.trigger,
      }),
    );

    return wf;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get name(): string {
    return this._state.name;
  }
  get trigger(): string {
    return this._state.trigger;
  }
  get steps(): WorkflowStep[] {
    return this._state.steps;
  }
  get status(): WorkflowStatus {
    return this._state.status;
  }
  get version(): number {
    return this._state.version;
  }

  activate(): void {
    if (
      this._state.status !== WorkflowStatus.Draft &&
      this._state.status !== WorkflowStatus.Inactive
    )
      throw new DomainError(
        "WORKFLOW_CANNOT_ACTIVATE",
        "Workflow can only be activated from Draft or Inactive.",
      );
    this._state.status = WorkflowStatus.Active;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent(
        "workflow_definition.activated",
        this._id,
        "WorkflowDefinition",
        this._state.tenantId,
        {},
      ),
    );
  }

  deactivate(): void {
    if (this._state.status !== WorkflowStatus.Active)
      throw new DomainError("WORKFLOW_NOT_ACTIVE", "Only active workflows can be deactivated.");
    this._state.status = WorkflowStatus.Inactive;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent(
        "workflow_definition.deactivated",
        this._id,
        "WorkflowDefinition",
        this._state.tenantId,
        {},
      ),
    );
  }
}
