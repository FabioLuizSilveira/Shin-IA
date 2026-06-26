// ─── Common ───────────────────────────────────────────────────────────────────

export type StudioType =
  | "branding"
  | "workflow"
  | "rule"
  | "access_control"
  | "dashboard"
  | "forms"
  | "blueprint"
  | "integration"
  | "notification"
  | "commercial";

export interface StudioDraft<T> {
  id: string;
  tenantId: string;
  studioType: StudioType;
  config: T;
  updatedAt: string;
  updatedBy: string;
}

export interface StudioVersion<T> {
  id: string;
  tenantId: string;
  studioType: StudioType;
  version: number;
  config: T;
  publishedAt: string;
  publishedBy: string;
  changelog?: string;
}

// ─── Branding Studio ──────────────────────────────────────────────────────────

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

export interface Typography {
  fontFamily: string;
  headingFontFamily?: string;
  baseSizeRem: number;
  scaleRatio: number;
}

export interface BrandingConfig {
  companyName: string;
  logoUrl?: string;
  faviconUrl?: string;
  colorPalette: ColorPalette;
  typography: Typography;
  customDomain?: string;
  whiteLabel: boolean;
  poweredByVisible: boolean;
  customCss?: string;
}

// ─── Workflow Studio ──────────────────────────────────────────────────────────

export type WorkflowStateType = "initial" | "intermediate" | "terminal";
export type WorkflowGuardType =
  | "role_check"
  | "condition_check"
  | "approval_required"
  | "field_not_empty"
  | "custom";
export type WorkflowActionType =
  | "notify"
  | "assign"
  | "update_field"
  | "emit_event"
  | "webhook"
  | "custom";

export interface WorkflowGuard {
  type: WorkflowGuardType;
  config: Record<string, unknown>;
}

export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, unknown>;
}

export interface WorkflowState {
  id: string;
  name: string;
  type: WorkflowStateType;
  description?: string;
  entryActions: WorkflowAction[];
  exitActions: WorkflowAction[];
}

export interface WorkflowTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  name: string;
  guards: WorkflowGuard[];
  actions: WorkflowAction[];
  requiresApproval: boolean;
  approvalRoles?: string[];
}

export interface WorkflowDefinition {
  name: string;
  entityType: string;
  description?: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

export interface WorkflowConfig {
  workflows: WorkflowDefinition[];
}

// ─── Rule Studio ──────────────────────────────────────────────────────────────

export type RuleOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "is_null"
  | "is_not_null";

export type RuleActionType =
  | "notify"
  | "block"
  | "assign"
  | "update_field"
  | "emit_event"
  | "webhook"
  | "custom";

export type RuleTrigger =
  | "on_create"
  | "on_update"
  | "on_delete"
  | "on_status_change"
  | "on_field_change"
  | "scheduled"
  | "manual";

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: unknown;
  connector?: "AND" | "OR";
}

export interface RuleAction {
  type: RuleActionType;
  config: Record<string, unknown>;
}

export interface RuleDefinition {
  name: string;
  entityType: string;
  trigger: RuleTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
  description?: string;
}

export interface RuleConfig {
  rules: RuleDefinition[];
}

// ─── Access Control Studio ────────────────────────────────────────────────────

export type PolicyEffect = "allow" | "deny";
export type PolicyScope = "tenant" | "branch" | "asset" | "user" | "global";

export interface PolicyCondition {
  attribute: string;
  operator: "eq" | "in" | "contains";
  value: unknown;
}

export interface AccessPolicy {
  id: string;
  name: string;
  resource: string;
  action: string;
  effect: PolicyEffect;
  scope: PolicyScope;
  conditions: PolicyCondition[];
  priority: number;
}

export interface RoleOverride {
  roleId: string;
  additionalPermissions: string[];
  restrictedPermissions: string[];
  scope?: PolicyScope;
}

export interface AccessControlConfig {
  policies: AccessPolicy[];
  roleOverrides: RoleOverride[];
  defaultDenyAll: boolean;
  mfaRequiredForRoles: string[];
}

// ─── Dashboard Studio ─────────────────────────────────────────────────────────

export type WidgetType = "kpi" | "chart" | "table" | "map" | "alert" | "custom";
export type ChartType = "line" | "bar" | "pie" | "donut" | "area" | "scatter";
export type RefreshInterval = 0 | 30 | 60 | 300 | 900 | 3600;

export interface WidgetDataSource {
  engine: string;
  metric: string;
  filters?: Record<string, unknown>;
  aggregation?: string;
  groupBy?: string;
}

export interface WidgetPosition {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface WidgetDefinition {
  id: string;
  type: WidgetType;
  title: string;
  dataSource: WidgetDataSource;
  chartType?: ChartType;
  refreshInterval: RefreshInterval;
  position: WidgetPosition;
  visible: boolean;
  config?: Record<string, unknown>;
}

export interface DashboardConfig {
  name: string;
  description?: string;
  columns: number;
  widgets: WidgetDefinition[];
  isDefault: boolean;
  allowedRoles: string[];
}

// ─── Forms Studio ─────────────────────────────────────────────────────────────

export type FieldType =
  | "text"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multiselect"
  | "file"
  | "signature"
  | "location"
  | "custom";

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldCondition {
  dependsOnField: string;
  operator: "eq" | "neq" | "in" | "is_filled";
  value?: unknown;
}

export interface FormField {
  id: string;
  type: FieldType;
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: unknown;
  validation?: FieldValidation;
  options?: FieldOption[];
  condition?: FieldCondition;
  helpText?: string;
  order: number;
}

export interface FormSubmitAction {
  type: "api_call" | "emit_event" | "redirect" | "webhook";
  config: Record<string, unknown>;
}

export interface FormDefinition {
  name: string;
  entityType: string;
  fields: FormField[];
  submitActions: FormSubmitAction[];
  allowDraft: boolean;
  description?: string;
  successMessage?: string;
}

export interface FormsConfig {
  forms: FormDefinition[];
}

// ─── Blueprint Studio ─────────────────────────────────────────────────────────

export interface BlueprintFieldOverride {
  fieldId: string;
  label?: string;
  required?: boolean;
  hidden?: boolean;
  defaultValue?: unknown;
}

export interface BlueprintWorkflowOverride {
  workflowName: string;
  disabledTransitions?: string[];
  additionalGuards?: Record<string, WorkflowGuard[]>;
}

export interface BlueprintKpiOverride {
  kpiType: string;
  label: string;
  visible: boolean;
  thresholds?: { warning: number; critical: number };
}

export interface BlueprintStudioConfig {
  blueprintId: string;
  blueprintName: string;
  fieldOverrides: BlueprintFieldOverride[];
  workflowOverrides: BlueprintWorkflowOverride[];
  kpiOverrides: BlueprintKpiOverride[];
  customCapabilities: string[];
}

// ─── Integration Studio ───────────────────────────────────────────────────────

export interface ProviderTestConfig {
  providerId: string;
  testEndpointId?: string;
  samplePayload?: Record<string, unknown>;
}

export interface WebhookEventSubscription {
  eventType: string;
  webhookId: string;
  enabled: boolean;
}

export interface IntegrationStudioConfig {
  enabledProviders: string[];
  providerTestConfigs: ProviderTestConfig[];
  webhookSubscriptions: WebhookEventSubscription[];
  defaultRetryPolicyId?: string;
  alertOnFailureChannels: string[];
  throttlePerHour?: number;
}

// ─── Notification Studio ──────────────────────────────────────────────────────

export interface NotificationChannelConfig {
  channel: "email" | "sms" | "push" | "in_app" | "webhook";
  enabled: boolean;
  defaultFrom?: string;
  throttlePerHour?: number;
}

export interface QuietHours {
  start: string;
  end: string;
  timezone: string;
}

export interface NotificationTemplateOverride {
  templateName: string;
  subjectOverride?: string;
  bodyOverride?: string;
}

export interface NotificationStudioConfig {
  channels: NotificationChannelConfig[];
  globalQuietHours?: QuietHours;
  templateOverrides: NotificationTemplateOverride[];
  unsubscribeFooterEnabled: boolean;
  defaultSenderId?: string;
}

// ─── Commercial Studio ────────────────────────────────────────────────────────

export type CommissionBasis = "revenue" | "units" | "profit_margin" | "custom";
export type CommissionType = "percentage" | "fixed" | "tiered";
export type SettlementPeriod = "weekly" | "biweekly" | "monthly";

export interface CommissionTier {
  from: number;
  to?: number;
  rate: number;
}

export interface CommissionRuleConfig {
  name: string;
  basis: CommissionBasis;
  type: CommissionType;
  rate?: number;
  tiers?: CommissionTier[];
  conditions: RuleCondition[];
  priority: number;
}

export interface CommercialStudioConfig {
  defaultPlanName: string;
  rules: CommissionRuleConfig[];
  campaignEnabled: boolean;
  settlementPeriod: SettlementPeriod;
  approvalRequiredAbove?: number;
}

// ─── Union & Repository Interfaces ───────────────────────────────────────────

export type AnyStudioConfig =
  | BrandingConfig
  | WorkflowConfig
  | RuleConfig
  | AccessControlConfig
  | DashboardConfig
  | FormsConfig
  | BlueprintStudioConfig
  | IntegrationStudioConfig
  | NotificationStudioConfig
  | CommercialStudioConfig;

export interface StudioDraftRepository {
  save(draft: StudioDraft<AnyStudioConfig>): Promise<StudioDraft<AnyStudioConfig>>;
  findByStudio(
    studioType: StudioType,
    tenantId: string,
  ): Promise<StudioDraft<AnyStudioConfig> | null>;
  delete(studioType: StudioType, tenantId: string): Promise<void>;
}

export interface StudioVersionRepository {
  save(version: StudioVersion<AnyStudioConfig>): Promise<StudioVersion<AnyStudioConfig>>;
  findById(id: string): Promise<StudioVersion<AnyStudioConfig> | null>;
  findLatest(
    studioType: StudioType,
    tenantId: string,
  ): Promise<StudioVersion<AnyStudioConfig> | null>;
  listByStudio(studioType: StudioType, tenantId: string): Promise<StudioVersion<AnyStudioConfig>[]>;
}
