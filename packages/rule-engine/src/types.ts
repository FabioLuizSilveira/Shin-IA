// ─── Conditions ───────────────────────────────────────────────────────────────

export type ConditionOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "exists"
  | "notExists";

export interface SimpleCondition {
  type: "simple";
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface CompositeCondition {
  type: "and" | "or";
  conditions: Condition[];
}

export interface NotCondition {
  type: "not";
  condition: Condition;
}

export type Condition = SimpleCondition | CompositeCondition | NotCondition;

// ─── Actions ──────────────────────────────────────────────────────────────────

export interface NotifyAction {
  type: "notify";
  target: string;
  template: string;
  channel?: "email" | "sms" | "push" | "webhook";
  data?: Record<string, unknown>;
}

export interface BlockAction {
  type: "block";
  reason: string;
  code?: string;
}

export interface WorkflowTriggerAction {
  type: "workflow_trigger";
  workflowId: string;
  trigger: string;
  metadata?: Record<string, unknown>;
}

export interface SetFieldAction {
  type: "set_field";
  field: string;
  value: unknown;
}

export interface LogAction {
  type: "log";
  level: "info" | "warn" | "error";
  message: string;
}

export type RuleAction =
  | NotifyAction
  | BlockAction
  | WorkflowTriggerAction
  | SetFieldAction
  | LogAction;

// ─── Rule ─────────────────────────────────────────────────────────────────────

export interface Rule {
  id: string;
  name: string;
  description: string;
  tenantId: string | null;
  enabled: boolean;
  priority: number;
  condition: Condition;
  actions: RuleAction[];
  triggers: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Rule Context ─────────────────────────────────────────────────────────────

export interface RuleContext {
  tenantId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

// ─── Evaluation Results ───────────────────────────────────────────────────────

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsExecuted: RuleAction[];
  errors: string[];
  evaluatedAt: string;
}

export interface RuleRuntimeResult {
  eventType: string;
  tenantId: string;
  totalRulesEvaluated: number;
  matchedRules: number;
  results: RuleEvaluationResult[];
  blockedBy: BlockAction | null;
}

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface RuleRepository {
  findById(id: string): Promise<Rule | null>;
  findByTrigger(tenantId: string, eventType: string): Promise<Rule[]>;
  findByTenant(tenantId: string): Promise<Rule[]>;
  findPlatformRules(eventType: string): Promise<Rule[]>;
  save(rule: Rule): Promise<Rule>;
  update(rule: Rule): Promise<Rule>;
  delete(id: string): Promise<void>;
}
