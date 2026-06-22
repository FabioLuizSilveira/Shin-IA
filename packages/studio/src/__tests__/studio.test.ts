import { describe, expect, it, vi } from "vitest";
import {
  StudioError,
  StudioRuntime,
  validateAccessControlConfig,
  validateBlueprintStudioConfig,
  validateBrandingConfig,
  validateCommercialStudioConfig,
  validateDashboardConfig,
  validateFormsConfig,
  validateIntegrationStudioConfig,
  validateNotificationStudioConfig,
  validateRuleConfig,
  validateStudioConfig,
  validateWorkflowConfig,
} from "../index.js";
import type {
  AccessControlConfig,
  AnyStudioConfig,
  BlueprintStudioConfig,
  BrandingConfig,
  ColorPalette,
  CommercialStudioConfig,
  DashboardConfig,
  FormsConfig,
  IntegrationStudioConfig,
  NotificationStudioConfig,
  RuleConfig,
  StudioDraft,
  StudioDraftRepository,
  StudioVersion,
  StudioVersionRepository,
  WorkflowConfig,
} from "../index.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validPalette: ColorPalette = {
  primary: "#1a73e8",
  secondary: "#34a853",
  accent: "#fbbc04",
  background: "#ffffff",
  surface: "#f8f9fa",
  text: "#202124",
  textSecondary: "#5f6368",
  border: "#dadce0",
  error: "#d93025",
  warning: "#f9ab00",
  success: "#1e8e3e",
  info: "#1a73e8",
};

const validBranding: BrandingConfig = {
  companyName: "Acme Rental",
  colorPalette: validPalette,
  typography: { fontFamily: "Inter", baseSizeRem: 1, scaleRatio: 1.25 },
  whiteLabel: true,
  poweredByVisible: false,
};

const validWorkflow: WorkflowConfig = {
  workflows: [
    {
      name: "Order Lifecycle",
      entityType: "order",
      states: [
        { id: "s1", name: "Created", type: "initial", entryActions: [], exitActions: [] },
        { id: "s2", name: "Active", type: "intermediate", entryActions: [], exitActions: [] },
        { id: "s3", name: "Done", type: "terminal", entryActions: [], exitActions: [] },
      ],
      transitions: [
        {
          id: "t1",
          fromStateId: "s1",
          toStateId: "s2",
          name: "Activate",
          guards: [],
          actions: [],
          requiresApproval: false,
        },
        {
          id: "t2",
          fromStateId: "s2",
          toStateId: "s3",
          name: "Complete",
          guards: [],
          actions: [],
          requiresApproval: false,
        },
      ],
    },
  ],
};

const validRule: RuleConfig = {
  rules: [
    {
      name: "Speed Alert",
      entityType: "asset",
      trigger: "on_update",
      conditions: [{ field: "speed", operator: "gt", value: 120 }],
      actions: [{ type: "notify", config: { channel: "email" } }],
      priority: 1,
      enabled: true,
    },
  ],
};

const validAccessControl: AccessControlConfig = {
  policies: [
    {
      id: "p1",
      name: "Fleet Read",
      resource: "fleet",
      action: "read",
      effect: "allow",
      scope: "tenant",
      conditions: [],
      priority: 10,
    },
  ],
  roleOverrides: [],
  defaultDenyAll: false,
  mfaRequiredForRoles: [],
};

const validDashboard: DashboardConfig = {
  name: "Operations Dashboard",
  columns: 12,
  widgets: [
    {
      id: "w1",
      type: "kpi",
      title: "Active Assets",
      dataSource: { engine: "tracking", metric: "active_assets" },
      refreshInterval: 60,
      position: { col: 0, row: 0, colSpan: 3, rowSpan: 1 },
      visible: true,
    },
  ],
  isDefault: true,
  allowedRoles: ["admin"],
};

const validForms: FormsConfig = {
  forms: [
    {
      name: "Asset Check-out",
      entityType: "asset",
      fields: [
        {
          id: "f1",
          type: "text",
          name: "notes",
          label: "Notes",
          order: 1,
        },
        {
          id: "f2",
          type: "select",
          name: "condition",
          label: "Condition",
          order: 2,
          options: [
            { label: "Good", value: "good" },
            { label: "Fair", value: "fair" },
          ],
        },
      ],
      submitActions: [],
      allowDraft: false,
    },
  ],
};

const validBlueprint: BlueprintStudioConfig = {
  blueprintId: "mobility",
  blueprintName: "Mobility",
  fieldOverrides: [],
  workflowOverrides: [],
  kpiOverrides: [],
  customCapabilities: [],
};

const validIntegration: IntegrationStudioConfig = {
  enabledProviders: ["sap-erp"],
  providerTestConfigs: [],
  webhookSubscriptions: [],
  alertOnFailureChannels: ["email"],
};

const validNotification: NotificationStudioConfig = {
  channels: [
    { channel: "email", enabled: true },
    { channel: "sms", enabled: false },
  ],
  templateOverrides: [],
  unsubscribeFooterEnabled: true,
};

const validCommercial: CommercialStudioConfig = {
  defaultPlanName: "Standard",
  rules: [],
  campaignEnabled: false,
  settlementPeriod: "monthly",
};

// ─── Mock repos ───────────────────────────────────────────────────────────────

function makeDraftRepo(draft: StudioDraft<AnyStudioConfig> | null = null): StudioDraftRepository {
  return {
    save: vi.fn().mockImplementation((d: StudioDraft<AnyStudioConfig>) => Promise.resolve(d)),
    findByStudio: vi.fn().mockResolvedValue(draft),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeVersionRepo(
  latest: StudioVersion<AnyStudioConfig> | null = null,
  versions: StudioVersion<AnyStudioConfig>[] = [],
): StudioVersionRepository {
  return {
    save: vi.fn().mockImplementation((v: StudioVersion<AnyStudioConfig>) => Promise.resolve(v)),
    findById: vi.fn().mockResolvedValue(latest),
    findLatest: vi.fn().mockResolvedValue(latest),
    listByStudio: vi.fn().mockResolvedValue(versions),
  };
}

function makeRuntime(
  draft: StudioDraft<AnyStudioConfig> | null = null,
  latest: StudioVersion<AnyStudioConfig> | null = null,
  versions: StudioVersion<AnyStudioConfig>[] = [],
): StudioRuntime {
  return new StudioRuntime(makeDraftRepo(draft), makeVersionRepo(latest, versions));
}

// ─── validateBrandingConfig ───────────────────────────────────────────────────

describe("validateBrandingConfig", () => {
  it("accepts a valid branding config", () => {
    const result = validateBrandingConfig(validBranding);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty companyName", () => {
    const result = validateBrandingConfig({ ...validBranding, companyName: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("companyName is required");
  });

  it("rejects empty fontFamily", () => {
    const result = validateBrandingConfig({
      ...validBranding,
      typography: { ...validBranding.typography, fontFamily: "" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("fontFamily"))).toBe(true);
  });

  it("rejects baseSizeRem below 0.5", () => {
    const result = validateBrandingConfig({
      ...validBranding,
      typography: { ...validBranding.typography, baseSizeRem: 0.4 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("baseSizeRem"))).toBe(true);
  });

  it("rejects baseSizeRem above 2", () => {
    const result = validateBrandingConfig({
      ...validBranding,
      typography: { ...validBranding.typography, baseSizeRem: 2.5 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("baseSizeRem"))).toBe(true);
  });

  it("rejects invalid hex color", () => {
    const result = validateBrandingConfig({
      ...validBranding,
      colorPalette: { ...validPalette, primary: "blue" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("colorPalette.primary"))).toBe(true);
  });

  it("rejects invalid logoUrl when non-empty", () => {
    const result = validateBrandingConfig({ ...validBranding, logoUrl: "not-a-url" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("logoUrl"))).toBe(true);
  });

  it("accepts empty string logoUrl", () => {
    const result = validateBrandingConfig({ ...validBranding, logoUrl: "" });
    expect(result.valid).toBe(true);
  });

  it("accepts undefined logoUrl", () => {
    const result = validateBrandingConfig({ ...validBranding, logoUrl: undefined });
    expect(result.valid).toBe(true);
  });

  it("accepts valid https logoUrl", () => {
    const result = validateBrandingConfig({
      ...validBranding,
      logoUrl: "https://cdn.example.com/logo.png",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid customDomain when non-empty", () => {
    const result = validateBrandingConfig({
      ...validBranding,
      customDomain: "not a domain!!",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("customDomain"))).toBe(true);
  });

  it("accepts undefined customDomain", () => {
    const result = validateBrandingConfig({ ...validBranding, customDomain: undefined });
    expect(result.valid).toBe(true);
  });

  it("accepts empty string customDomain", () => {
    const result = validateBrandingConfig({ ...validBranding, customDomain: "" });
    expect(result.valid).toBe(true);
  });
});

// ─── validateWorkflowConfig ───────────────────────────────────────────────────

describe("validateWorkflowConfig", () => {
  it("accepts a valid workflow", () => {
    expect(validateWorkflowConfig(validWorkflow).valid).toBe(true);
  });

  it("accepts an empty workflows list", () => {
    expect(validateWorkflowConfig({ workflows: [] }).valid).toBe(true);
  });

  it("rejects workflow with no states", () => {
    const result = validateWorkflowConfig({
      workflows: [{ ...validWorkflow.workflows[0]!, states: [], transitions: [] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least one state"))).toBe(true);
  });

  it("rejects workflow with no initial state", () => {
    const result = validateWorkflowConfig({
      workflows: [
        {
          ...validWorkflow.workflows[0]!,
          states: [
            { id: "s1", name: "A", type: "intermediate", entryActions: [], exitActions: [] },
            { id: "s2", name: "B", type: "terminal", entryActions: [], exitActions: [] },
          ],
          transitions: [],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("exactly one initial state"))).toBe(true);
  });

  it("rejects workflow with no terminal state", () => {
    const result = validateWorkflowConfig({
      workflows: [
        {
          ...validWorkflow.workflows[0]!,
          states: [
            { id: "s1", name: "A", type: "initial", entryActions: [], exitActions: [] },
            { id: "s2", name: "B", type: "intermediate", entryActions: [], exitActions: [] },
          ],
          transitions: [],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("terminal state"))).toBe(true);
  });

  it("rejects duplicate state ids", () => {
    const result = validateWorkflowConfig({
      workflows: [
        {
          ...validWorkflow.workflows[0]!,
          states: [
            { id: "s1", name: "A", type: "initial", entryActions: [], exitActions: [] },
            { id: "s1", name: "B", type: "terminal", entryActions: [], exitActions: [] },
          ],
          transitions: [],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("duplicate state id"))).toBe(true);
  });

  it("rejects transition referencing unknown fromStateId", () => {
    const result = validateWorkflowConfig({
      workflows: [
        {
          ...validWorkflow.workflows[0]!,
          transitions: [
            { ...validWorkflow.workflows[0]!.transitions[0]!, fromStateId: "nonexistent" },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("fromStateId"))).toBe(true);
  });

  it("rejects transition referencing unknown toStateId", () => {
    const result = validateWorkflowConfig({
      workflows: [
        {
          ...validWorkflow.workflows[0]!,
          transitions: [
            { ...validWorkflow.workflows[0]!.transitions[0]!, toStateId: "nonexistent" },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("toStateId"))).toBe(true);
  });
});

// ─── validateRuleConfig ───────────────────────────────────────────────────────

describe("validateRuleConfig", () => {
  it("accepts a valid rule config", () => {
    expect(validateRuleConfig(validRule).valid).toBe(true);
  });

  it("accepts empty rules list", () => {
    expect(validateRuleConfig({ rules: [] }).valid).toBe(true);
  });

  it("rejects rule with empty name", () => {
    const result = validateRuleConfig({
      rules: [{ ...validRule.rules[0]!, name: "  " }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("name is required"))).toBe(true);
  });

  it("rejects rule with no conditions", () => {
    const result = validateRuleConfig({
      rules: [{ ...validRule.rules[0]!, conditions: [] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("condition"))).toBe(true);
  });

  it("rejects rule with no actions", () => {
    const result = validateRuleConfig({
      rules: [{ ...validRule.rules[0]!, actions: [] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("action"))).toBe(true);
  });

  it("rejects rule with priority <= 0", () => {
    const result = validateRuleConfig({
      rules: [{ ...validRule.rules[0]!, priority: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("priority"))).toBe(true);
  });
});

// ─── validateAccessControlConfig ─────────────────────────────────────────────

describe("validateAccessControlConfig", () => {
  it("accepts a valid access control config", () => {
    expect(validateAccessControlConfig(validAccessControl).valid).toBe(true);
  });

  it("rejects policy with empty resource", () => {
    const result = validateAccessControlConfig({
      ...validAccessControl,
      policies: [{ ...validAccessControl.policies[0]!, resource: "" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("resource"))).toBe(true);
  });

  it("rejects policy with empty action", () => {
    const result = validateAccessControlConfig({
      ...validAccessControl,
      policies: [{ ...validAccessControl.policies[0]!, action: "" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("action"))).toBe(true);
  });

  it("rejects policy with priority <= 0", () => {
    const result = validateAccessControlConfig({
      ...validAccessControl,
      policies: [{ ...validAccessControl.policies[0]!, priority: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("priority"))).toBe(true);
  });

  it("rejects role override with conflicting permissions", () => {
    const result = validateAccessControlConfig({
      ...validAccessControl,
      roleOverrides: [
        {
          roleId: "admin",
          additionalPermissions: ["fleet:write"],
          restrictedPermissions: ["fleet:write"],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("both additional and restricted"))).toBe(true);
  });

  it("accepts role override without conflicts", () => {
    const result = validateAccessControlConfig({
      ...validAccessControl,
      roleOverrides: [
        {
          roleId: "manager",
          additionalPermissions: ["fleet:write"],
          restrictedPermissions: ["fleet:delete"],
        },
      ],
    });
    expect(result.valid).toBe(true);
  });
});

// ─── validateDashboardConfig ──────────────────────────────────────────────────

describe("validateDashboardConfig", () => {
  it("accepts a valid dashboard config", () => {
    expect(validateDashboardConfig(validDashboard).valid).toBe(true);
  });

  it("rejects columns below 1", () => {
    const result = validateDashboardConfig({ ...validDashboard, columns: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least 1"))).toBe(true);
  });

  it("rejects columns above 24", () => {
    const result = validateDashboardConfig({ ...validDashboard, columns: 25 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("cannot exceed 24"))).toBe(true);
  });

  it("rejects duplicate widget ids", () => {
    const result = validateDashboardConfig({
      ...validDashboard,
      widgets: [validDashboard.widgets[0]!, validDashboard.widgets[0]!],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate widget id"))).toBe(true);
  });

  it("rejects widget that exceeds grid width", () => {
    const result = validateDashboardConfig({
      ...validDashboard,
      columns: 4,
      widgets: [
        {
          ...validDashboard.widgets[0]!,
          position: { col: 2, row: 0, colSpan: 5, rowSpan: 1 },
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("extends beyond"))).toBe(true);
  });
});

// ─── validateFormsConfig ──────────────────────────────────────────────────────

describe("validateFormsConfig", () => {
  it("accepts a valid forms config", () => {
    expect(validateFormsConfig(validForms).valid).toBe(true);
  });

  it("accepts an empty forms list", () => {
    expect(validateFormsConfig({ forms: [] }).valid).toBe(true);
  });

  it("rejects form with no fields", () => {
    const result = validateFormsConfig({
      forms: [{ ...validForms.forms[0]!, fields: [] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least one field"))).toBe(true);
  });

  it("rejects form with duplicate field names", () => {
    const field = validForms.forms[0]!.fields[0]!;
    const result = validateFormsConfig({
      forms: [{ ...validForms.forms[0]!, fields: [field, { ...field, id: "f99" }] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("duplicate field name"))).toBe(true);
  });

  it("rejects select field with no options", () => {
    const result = validateFormsConfig({
      forms: [
        {
          ...validForms.forms[0]!,
          fields: [
            {
              id: "f1",
              type: "select",
              name: "status",
              label: "Status",
              order: 1,
              options: [],
            },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least one option"))).toBe(true);
  });

  it("rejects multiselect field with no options", () => {
    const result = validateFormsConfig({
      forms: [
        {
          ...validForms.forms[0]!,
          fields: [
            {
              id: "f1",
              type: "multiselect",
              name: "tags",
              label: "Tags",
              order: 1,
            },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least one option"))).toBe(true);
  });
});

// ─── validateBlueprintStudioConfig ────────────────────────────────────────────

describe("validateBlueprintStudioConfig", () => {
  it("accepts a valid blueprint studio config", () => {
    expect(validateBlueprintStudioConfig(validBlueprint).valid).toBe(true);
  });

  it("rejects empty blueprintId", () => {
    const result = validateBlueprintStudioConfig({ ...validBlueprint, blueprintId: " " });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("blueprintId"))).toBe(true);
  });

  it("rejects empty blueprintName", () => {
    const result = validateBlueprintStudioConfig({ ...validBlueprint, blueprintName: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("blueprintName"))).toBe(true);
  });
});

// ─── validateIntegrationStudioConfig ─────────────────────────────────────────

describe("validateIntegrationStudioConfig", () => {
  it("accepts a valid integration config", () => {
    expect(validateIntegrationStudioConfig(validIntegration).valid).toBe(true);
  });

  it("accepts missing throttlePerHour", () => {
    const result = validateIntegrationStudioConfig({
      ...validIntegration,
      throttlePerHour: undefined,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects throttlePerHour <= 0", () => {
    const result = validateIntegrationStudioConfig({
      ...validIntegration,
      throttlePerHour: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("throttlePerHour"))).toBe(true);
  });
});

// ─── validateNotificationStudioConfig ────────────────────────────────────────

describe("validateNotificationStudioConfig", () => {
  it("accepts a valid notification config", () => {
    expect(validateNotificationStudioConfig(validNotification).valid).toBe(true);
  });

  it("rejects when all channels disabled", () => {
    const result = validateNotificationStudioConfig({
      ...validNotification,
      channels: [
        { channel: "email", enabled: false },
        { channel: "sms", enabled: false },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("At least one"))).toBe(true);
  });

  it("accepts missing globalQuietHours", () => {
    const result = validateNotificationStudioConfig({
      ...validNotification,
      globalQuietHours: undefined,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid quiet hours start", () => {
    const result = validateNotificationStudioConfig({
      ...validNotification,
      globalQuietHours: { start: "25:00", end: "08:00", timezone: "UTC" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("start"))).toBe(true);
  });

  it("rejects invalid quiet hours end", () => {
    const result = validateNotificationStudioConfig({
      ...validNotification,
      globalQuietHours: { start: "22:00", end: "99:99", timezone: "UTC" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("end"))).toBe(true);
  });
});

// ─── validateCommercialStudioConfig ──────────────────────────────────────────

describe("validateCommercialStudioConfig", () => {
  it("accepts a valid commercial config with no rules", () => {
    expect(validateCommercialStudioConfig(validCommercial).valid).toBe(true);
  });

  it("accepts a tiered rule with valid tiers", () => {
    const result = validateCommercialStudioConfig({
      ...validCommercial,
      rules: [
        {
          name: "Tiered Commission",
          basis: "revenue",
          type: "tiered",
          conditions: [],
          priority: 1,
          tiers: [
            { from: 0, to: 1000, rate: 0.05 },
            { from: 1000, to: 5000, rate: 0.08 },
          ],
        },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects tiered rule with no tiers", () => {
    const result = validateCommercialStudioConfig({
      ...validCommercial,
      rules: [
        {
          name: "Bad Tiered",
          basis: "revenue",
          type: "tiered",
          conditions: [],
          priority: 1,
          tiers: [],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least one tier"))).toBe(true);
  });

  it("rejects tiered rule with missing tiers", () => {
    const result = validateCommercialStudioConfig({
      ...validCommercial,
      rules: [
        {
          name: "Bad Tiered",
          basis: "revenue",
          type: "tiered",
          conditions: [],
          priority: 1,
        },
      ],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects tier with negative from", () => {
    const result = validateCommercialStudioConfig({
      ...validCommercial,
      rules: [
        {
          name: "Negative Tier",
          basis: "revenue",
          type: "tiered",
          conditions: [],
          priority: 1,
          tiers: [{ from: -10, to: 100, rate: 0.05 }],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("non-negative"))).toBe(true);
  });

  it("rejects tier where to <= from", () => {
    const result = validateCommercialStudioConfig({
      ...validCommercial,
      rules: [
        {
          name: "Bad Range",
          basis: "revenue",
          type: "tiered",
          conditions: [],
          priority: 1,
          tiers: [{ from: 500, to: 500, rate: 0.05 }],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("greater than"))).toBe(true);
  });
});

// ─── validateStudioConfig (dispatcher) ───────────────────────────────────────

describe("validateStudioConfig (dispatcher)", () => {
  it("dispatches branding", () => {
    const r = validateStudioConfig("branding", validBranding);
    expect(r.valid).toBe(true);
  });
  it("dispatches workflow", () => {
    const r = validateStudioConfig("workflow", validWorkflow);
    expect(r.valid).toBe(true);
  });
  it("dispatches rule", () => {
    const r = validateStudioConfig("rule", validRule);
    expect(r.valid).toBe(true);
  });
  it("dispatches access_control", () => {
    const r = validateStudioConfig("access_control", validAccessControl);
    expect(r.valid).toBe(true);
  });
  it("dispatches dashboard", () => {
    const r = validateStudioConfig("dashboard", validDashboard);
    expect(r.valid).toBe(true);
  });
  it("dispatches forms", () => {
    const r = validateStudioConfig("forms", validForms);
    expect(r.valid).toBe(true);
  });
  it("dispatches blueprint", () => {
    const r = validateStudioConfig("blueprint", validBlueprint);
    expect(r.valid).toBe(true);
  });
  it("dispatches integration", () => {
    const r = validateStudioConfig("integration", validIntegration);
    expect(r.valid).toBe(true);
  });
  it("dispatches notification", () => {
    const r = validateStudioConfig("notification", validNotification);
    expect(r.valid).toBe(true);
  });
  it("dispatches commercial", () => {
    const r = validateStudioConfig("commercial", validCommercial);
    expect(r.valid).toBe(true);
  });
});

// ─── StudioRuntime ────────────────────────────────────────────────────────────

describe("StudioRuntime", () => {
  describe("validate", () => {
    it("delegates to the correct validator", () => {
      const runtime = makeRuntime();
      const result = runtime.validate("branding", validBranding);
      expect(result.valid).toBe(true);
    });
  });

  describe("saveDraft", () => {
    it("saves a valid draft", async () => {
      const runtime = makeRuntime();
      const draft = await runtime.saveDraft("branding", "t1", validBranding, "actor1");
      expect(draft.studioType).toBe("branding");
      expect(draft.tenantId).toBe("t1");
    });

    it("throws StudioError on validation failure", async () => {
      const runtime = makeRuntime();
      const bad = { ...validBranding, companyName: "" };
      await expect(runtime.saveDraft("branding", "t1", bad, "a1")).rejects.toThrow(StudioError);
    });

    it("StudioError has VALIDATION_FAILED code", async () => {
      const runtime = makeRuntime();
      const bad = { ...validBranding, companyName: "" };
      try {
        await runtime.saveDraft("branding", "t1", bad, "a1");
      } catch (e) {
        expect(e).toBeInstanceOf(StudioError);
        expect((e as StudioError).code).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("publish", () => {
    it("publishes first version (version = 1) when no previous", async () => {
      const draft: StudioDraft<AnyStudioConfig> = {
        id: "d1",
        tenantId: "t1",
        studioType: "branding",
        config: validBranding,
        updatedAt: new Date().toISOString(),
        updatedBy: "actor1",
      };
      const runtime = makeRuntime(draft, null);
      const version = await runtime.publish("branding", "t1", "actor1", "Initial release");
      expect(version.version).toBe(1);
      expect(version.changelog).toBe("Initial release");
    });

    it("increments version number when previous exists", async () => {
      const draft: StudioDraft<AnyStudioConfig> = {
        id: "d1",
        tenantId: "t1",
        studioType: "branding",
        config: validBranding,
        updatedAt: new Date().toISOString(),
        updatedBy: "actor1",
      };
      const latest: StudioVersion<AnyStudioConfig> = {
        id: "v1",
        tenantId: "t1",
        studioType: "branding",
        version: 3,
        config: validBranding,
        publishedAt: new Date().toISOString(),
        publishedBy: "actor1",
      };
      const runtime = makeRuntime(draft, latest);
      const version = await runtime.publish("branding", "t1", "actor1");
      expect(version.version).toBe(4);
    });

    it("throws DRAFT_NOT_FOUND when no draft", async () => {
      const runtime = makeRuntime(null);
      await expect(runtime.publish("branding", "t1", "actor1")).rejects.toThrow(StudioError);
      try {
        await runtime.publish("branding", "t1", "actor1");
      } catch (e) {
        expect((e as StudioError).code).toBe("DRAFT_NOT_FOUND");
      }
    });
  });

  describe("getDraft", () => {
    it("returns draft when found", async () => {
      const draft: StudioDraft<AnyStudioConfig> = {
        id: "d1",
        tenantId: "t1",
        studioType: "branding",
        config: validBranding,
        updatedAt: new Date().toISOString(),
        updatedBy: "actor1",
      };
      const runtime = makeRuntime(draft);
      expect(await runtime.getDraft("branding", "t1")).toBe(draft);
    });

    it("returns null when no draft", async () => {
      const runtime = makeRuntime(null);
      expect(await runtime.getDraft("branding", "t1")).toBeNull();
    });
  });

  describe("getPublished", () => {
    it("returns the latest version", async () => {
      const latest: StudioVersion<AnyStudioConfig> = {
        id: "v1",
        tenantId: "t1",
        studioType: "branding",
        version: 1,
        config: validBranding,
        publishedAt: new Date().toISOString(),
        publishedBy: "actor1",
      };
      const runtime = makeRuntime(null, latest);
      expect(await runtime.getPublished("branding", "t1")).toBe(latest);
    });

    it("returns null when never published", async () => {
      const runtime = makeRuntime(null, null);
      expect(await runtime.getPublished("branding", "t1")).toBeNull();
    });
  });

  describe("getVersionHistory", () => {
    it("returns all versions", async () => {
      const versions: StudioVersion<AnyStudioConfig>[] = [
        {
          id: "v1",
          tenantId: "t1",
          studioType: "branding",
          version: 1,
          config: validBranding,
          publishedAt: new Date().toISOString(),
          publishedBy: "actor1",
        },
        {
          id: "v2",
          tenantId: "t1",
          studioType: "branding",
          version: 2,
          config: validBranding,
          publishedAt: new Date().toISOString(),
          publishedBy: "actor1",
        },
      ];
      const runtime = makeRuntime(null, null, versions);
      const history = await runtime.getVersionHistory("branding", "t1");
      expect(history).toHaveLength(2);
    });
  });

  describe("revertToVersion", () => {
    it("creates a new version with the target config", async () => {
      const targetVersion: StudioVersion<AnyStudioConfig> = {
        id: "v1",
        tenantId: "t1",
        studioType: "branding",
        version: 1,
        config: validBranding,
        publishedAt: new Date().toISOString(),
        publishedBy: "actor1",
      };
      const latestVersion: StudioVersion<AnyStudioConfig> = {
        ...targetVersion,
        id: "v3",
        version: 3,
      };

      const draftRepo = makeDraftRepo();
      const versionRepo: StudioVersionRepository = {
        save: vi.fn().mockImplementation((v: StudioVersion<AnyStudioConfig>) => Promise.resolve(v)),
        findById: vi.fn().mockResolvedValue(targetVersion),
        findLatest: vi.fn().mockResolvedValue(latestVersion),
        listByStudio: vi.fn().mockResolvedValue([]),
      };
      const runtime = new StudioRuntime(draftRepo, versionRepo);

      const reverted = await runtime.revertToVersion("branding", "t1", "v1", "actor1");
      expect(reverted.version).toBe(4);
      expect(reverted.changelog).toContain("Reverted to version 1");
    });

    it("throws VERSION_NOT_FOUND when version does not exist", async () => {
      const draftRepo = makeDraftRepo();
      const versionRepo: StudioVersionRepository = {
        save: vi.fn().mockResolvedValue(undefined as unknown as StudioVersion<AnyStudioConfig>),
        findById: vi.fn().mockResolvedValue(null),
        findLatest: vi.fn().mockResolvedValue(null),
        listByStudio: vi.fn().mockResolvedValue([]),
      };
      const runtime = new StudioRuntime(draftRepo, versionRepo);

      await expect(
        runtime.revertToVersion("branding", "t1", "nonexistent", "actor1"),
      ).rejects.toThrow(StudioError);
      try {
        await runtime.revertToVersion("branding", "t1", "nonexistent", "actor1");
      } catch (e) {
        expect((e as StudioError).code).toBe("VERSION_NOT_FOUND");
      }
    });

    it("sets version to 1 when no previous exists", async () => {
      const targetVersion: StudioVersion<AnyStudioConfig> = {
        id: "v1",
        tenantId: "t1",
        studioType: "branding",
        version: 1,
        config: validBranding,
        publishedAt: new Date().toISOString(),
        publishedBy: "actor1",
      };
      const draftRepo = makeDraftRepo();
      const versionRepo: StudioVersionRepository = {
        save: vi.fn().mockImplementation((v: StudioVersion<AnyStudioConfig>) => Promise.resolve(v)),
        findById: vi.fn().mockResolvedValue(targetVersion),
        findLatest: vi.fn().mockResolvedValue(null),
        listByStudio: vi.fn().mockResolvedValue([]),
      };
      const runtime = new StudioRuntime(draftRepo, versionRepo);

      const reverted = await runtime.revertToVersion("branding", "t1", "v1", "actor1");
      expect(reverted.version).toBe(1);
    });
  });
});
