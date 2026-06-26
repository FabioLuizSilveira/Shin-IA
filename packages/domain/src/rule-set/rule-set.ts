import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import type { TenantId } from "../tenant/tenant.js";
import { RuleSetStatus } from "./rule-set-status.enum.js";
import { createEvent } from "../shared/create-event.js";

export type RuleSetId = string & { readonly __brand: "RuleSetId" };

export interface Rule {
  ruleId: string;
  condition: string;
  action: string;
  priority: number;
}

export interface CreateRuleSetProps {
  id: RuleSetId;
  tenantId: TenantId;
  name: string;
  context: string;
  rules: Rule[];
}

interface RuleSetState {
  tenantId: TenantId;
  name: string;
  context: string;
  rules: Rule[];
  status: RuleSetStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class RuleSet extends AggregateRoot<RuleSetId> {
  private _state: RuleSetState;

  private constructor(id: RuleSetId, state: RuleSetState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateRuleSetProps): RuleSet {
    if (!props.name.trim())
      throw new DomainError("RULE_SET_NAME_REQUIRED", "RuleSet name is required.");
    if (!props.context.trim())
      throw new DomainError("RULE_SET_CONTEXT_REQUIRED", "RuleSet context is required.");

    const now = new Date();
    const rs = new RuleSet(props.id, {
      ...props,
      status: RuleSetStatus.Draft,
      createdAt: now,
      updatedAt: now,
    });

    rs.raise(
      createEvent("rule_set.created", props.id, "RuleSet", props.tenantId, {
        name: props.name.trim(),
        context: props.context,
      }),
    );

    return rs;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get name(): string {
    return this._state.name;
  }
  get context(): string {
    return this._state.context;
  }
  get rules(): Rule[] {
    return this._state.rules;
  }
  get status(): RuleSetStatus {
    return this._state.status;
  }

  activate(): void {
    if (this._state.status !== RuleSetStatus.Draft && this._state.status !== RuleSetStatus.Inactive)
      throw new DomainError(
        "RULE_SET_CANNOT_ACTIVATE",
        "RuleSet can only be activated from Draft or Inactive.",
      );
    this._state.status = RuleSetStatus.Active;
    this._state.updatedAt = new Date();
    this.raise(createEvent("rule_set.activated", this._id, "RuleSet", this._state.tenantId, {}));
  }

  addRule(rule: Rule): void {
    const exists = this._state.rules.some((r) => r.ruleId === rule.ruleId);
    if (exists)
      throw new DomainError(
        "RULE_ALREADY_EXISTS",
        `Rule ${rule.ruleId} already exists in this set.`,
      );
    this._state.rules.push(rule);
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("rule_set.rule_added", this._id, "RuleSet", this._state.tenantId, {
        ruleId: rule.ruleId,
      }),
    );
  }
}
