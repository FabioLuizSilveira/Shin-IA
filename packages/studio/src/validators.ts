import type {
  AccessControlConfig,
  AnyStudioConfig,
  BlueprintStudioConfig,
  BrandingConfig,
  CommercialStudioConfig,
  DashboardConfig,
  FormsConfig,
  IntegrationStudioConfig,
  NotificationStudioConfig,
  RuleConfig,
  StudioType,
  WorkflowConfig,
} from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidHex(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
}

function isValidUrl(raw: string): boolean {
  try {
    new URL(raw);
    return true;
  } catch {
    return false;
  }
}

function isValidDomain(raw: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z]{2,})+$/.test(raw);
}

function isValidTime(raw: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw);
}

// ─── Branding ─────────────────────────────────────────────────────────────────

export function validateBrandingConfig(config: BrandingConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.companyName.trim()) {
    errors.push("companyName is required");
  }

  if (!config.typography.fontFamily.trim()) {
    errors.push("typography.fontFamily is required");
  }

  if (config.typography.baseSizeRem < 0.5 || config.typography.baseSizeRem > 2) {
    errors.push("typography.baseSizeRem must be between 0.5 and 2");
  }

  const palette = config.colorPalette as unknown as Record<string, string>;
  for (const [key, value] of Object.entries(palette)) {
    if (!isValidHex(value)) {
      errors.push(`colorPalette.${key} is not a valid hex color`);
    }
  }

  if (config.logoUrl !== undefined && config.logoUrl !== "" && !isValidUrl(config.logoUrl)) {
    errors.push("logoUrl is not a valid URL");
  }

  if (
    config.customDomain !== undefined &&
    config.customDomain !== "" &&
    !isValidDomain(config.customDomain)
  ) {
    errors.push("customDomain is not a valid domain");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export function validateWorkflowConfig(config: WorkflowConfig): ValidationResult {
  const errors: string[] = [];

  for (const wf of config.workflows) {
    if (wf.states.length === 0) {
      errors.push(`Workflow "${wf.name}" must have at least one state`);
      continue;
    }

    const stateIds = new Set<string>();
    for (const state of wf.states) {
      if (stateIds.has(state.id)) {
        errors.push(`Workflow "${wf.name}" has duplicate state id "${state.id}"`);
      }
      stateIds.add(state.id);
    }

    const initialStates = wf.states.filter((s) => s.type === "initial");
    if (initialStates.length !== 1) {
      errors.push(`Workflow "${wf.name}" must have exactly one initial state`);
    }

    const terminalStates = wf.states.filter((s) => s.type === "terminal");
    if (terminalStates.length === 0) {
      errors.push(`Workflow "${wf.name}" must have at least one terminal state`);
    }

    for (const t of wf.transitions) {
      if (!stateIds.has(t.fromStateId)) {
        errors.push(
          `Workflow "${wf.name}" transition "${t.id}" references unknown fromStateId "${t.fromStateId}"`,
        );
      }
      if (!stateIds.has(t.toStateId)) {
        errors.push(
          `Workflow "${wf.name}" transition "${t.id}" references unknown toStateId "${t.toStateId}"`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Rule ─────────────────────────────────────────────────────────────────────

export function validateRuleConfig(config: RuleConfig): ValidationResult {
  const errors: string[] = [];

  for (const rule of config.rules) {
    if (!rule.name.trim()) {
      errors.push("Rule name is required");
    }
    if (rule.conditions.length === 0) {
      errors.push(`Rule "${rule.name}" must have at least one condition`);
    }
    if (rule.actions.length === 0) {
      errors.push(`Rule "${rule.name}" must have at least one action`);
    }
    if (rule.priority <= 0) {
      errors.push(`Rule "${rule.name}" priority must be greater than 0`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Access Control ───────────────────────────────────────────────────────────

export function validateAccessControlConfig(config: AccessControlConfig): ValidationResult {
  const errors: string[] = [];

  for (const policy of config.policies) {
    if (!policy.resource.trim()) {
      errors.push(`Policy "${policy.id}" resource is required`);
    }
    if (!policy.action.trim()) {
      errors.push(`Policy "${policy.id}" action is required`);
    }
    if (policy.priority <= 0) {
      errors.push(`Policy "${policy.id}" priority must be greater than 0`);
    }
  }

  for (const override of config.roleOverrides) {
    const additional = new Set(override.additionalPermissions);
    for (const perm of override.restrictedPermissions) {
      if (additional.has(perm)) {
        errors.push(
          `RoleOverride "${override.roleId}" has permission "${perm}" in both additional and restricted`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function validateDashboardConfig(config: DashboardConfig): ValidationResult {
  const errors: string[] = [];

  if (config.columns < 1) {
    errors.push("columns must be at least 1");
  } else if (config.columns > 24) {
    errors.push("columns cannot exceed 24");
  }

  const widgetIds = new Set<string>();
  for (const widget of config.widgets) {
    if (widgetIds.has(widget.id)) {
      errors.push(`Duplicate widget id "${widget.id}"`);
    }
    widgetIds.add(widget.id);

    if (widget.position.col + widget.position.colSpan > config.columns) {
      errors.push(`Widget "${widget.id}" extends beyond the grid width`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export function validateFormsConfig(config: FormsConfig): ValidationResult {
  const errors: string[] = [];

  for (const form of config.forms) {
    if (form.fields.length === 0) {
      errors.push(`Form "${form.name}" must have at least one field`);
    }

    const fieldNames = new Set<string>();
    for (const field of form.fields) {
      if (fieldNames.has(field.name)) {
        errors.push(`Form "${form.name}" has duplicate field name "${field.name}"`);
      }
      fieldNames.add(field.name);

      if (
        (field.type === "select" || field.type === "multiselect") &&
        (!field.options || field.options.length === 0)
      ) {
        errors.push(
          `Form "${form.name}" field "${field.name}" of type "${field.type}" must have at least one option`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Blueprint Studio ─────────────────────────────────────────────────────────

export function validateBlueprintStudioConfig(config: BlueprintStudioConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.blueprintId.trim()) {
    errors.push("blueprintId is required");
  }
  if (!config.blueprintName.trim()) {
    errors.push("blueprintName is required");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Integration Studio ───────────────────────────────────────────────────────

export function validateIntegrationStudioConfig(config: IntegrationStudioConfig): ValidationResult {
  const errors: string[] = [];

  if (config.throttlePerHour !== undefined && config.throttlePerHour <= 0) {
    errors.push("throttlePerHour must be greater than 0");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Notification Studio ──────────────────────────────────────────────────────

export function validateNotificationStudioConfig(
  config: NotificationStudioConfig,
): ValidationResult {
  const errors: string[] = [];

  const hasEnabled = config.channels.some((c) => c.enabled);
  if (!hasEnabled) {
    errors.push("At least one notification channel must be enabled");
  }

  if (config.globalQuietHours !== undefined) {
    if (!isValidTime(config.globalQuietHours.start)) {
      errors.push("globalQuietHours.start must be in HH:MM format");
    }
    if (!isValidTime(config.globalQuietHours.end)) {
      errors.push("globalQuietHours.end must be in HH:MM format");
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Commercial Studio ────────────────────────────────────────────────────────

export function validateCommercialStudioConfig(config: CommercialStudioConfig): ValidationResult {
  const errors: string[] = [];

  for (const rule of config.rules) {
    if (rule.type === "tiered") {
      if (!rule.tiers || rule.tiers.length === 0) {
        errors.push(`Rule "${rule.name}" of type "tiered" must have at least one tier`);
        continue;
      }
      for (let i = 0; i < rule.tiers.length; i++) {
        const tier = rule.tiers[i];
        if (tier === undefined) continue;
        if (tier.from < 0) {
          errors.push(`Rule "${rule.name}" tier ${i} "from" must be non-negative`);
        }
        if (tier.to !== undefined && tier.to <= tier.from) {
          errors.push(`Rule "${rule.name}" tier ${i} "to" must be greater than "from"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function validateStudioConfig(
  studioType: StudioType,
  config: AnyStudioConfig,
): ValidationResult {
  switch (studioType) {
    case "branding":
      return validateBrandingConfig(config as BrandingConfig);
    case "workflow":
      return validateWorkflowConfig(config as WorkflowConfig);
    case "rule":
      return validateRuleConfig(config as RuleConfig);
    case "access_control":
      return validateAccessControlConfig(config as AccessControlConfig);
    case "dashboard":
      return validateDashboardConfig(config as DashboardConfig);
    case "forms":
      return validateFormsConfig(config as FormsConfig);
    case "blueprint":
      return validateBlueprintStudioConfig(config as BlueprintStudioConfig);
    case "integration":
      return validateIntegrationStudioConfig(config as IntegrationStudioConfig);
    case "notification":
      return validateNotificationStudioConfig(config as NotificationStudioConfig);
    case "commercial":
      return validateCommercialStudioConfig(config as CommercialStudioConfig);
  }
}
