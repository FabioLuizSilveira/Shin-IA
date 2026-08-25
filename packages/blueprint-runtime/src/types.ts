// ─── Blueprint ────────────────────────────────────────────────────────────────

export type BlueprintCategory =
  | "mobility"
  | "agriculture"
  | "construction"
  | "industrial"
  | "generic";

export type BlueprintStatus = "active" | "inactive" | "deprecated";

export type BlueprintInstanceStatus = "installing" | "active" | "error" | "uninstalling";

export interface BlueprintCapabilities {
  tracking: boolean;
  maintenance: boolean;
  commercial: boolean;
  notifications: boolean;
  reporting: boolean;
  workflow: boolean;
  integration: boolean;
  // Added for the Inspection Engine (docs/architecture/
  // INSPECTION_ENGINE.md) — whether this blueprint has digital-inspection
  // support (check-in/check-out checklists, resolved separately via
  // blueprint_inspection_mappings). All 10 built-ins default this true;
  // it exists so a future non-inspectable blueprint (e.g. a pure
  // software/virtual asset type) can opt out without special-casing it in
  // application code.
  inspection: boolean;
}

export interface BlueprintFieldSchema {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "date";
  required: boolean;
  options?: string[];
  defaultValue?: unknown;
}

export interface BlueprintManifest {
  id: string;
  name: string;
  displayName: string;
  version: string;
  category: BlueprintCategory;
  description: string;
  author: string;
  capabilities: BlueprintCapabilities;
  customFields: BlueprintFieldSchema[];
  dependencies: string[];
  minPlatformVersion: string;
  status: BlueprintStatus;
}

export interface BlueprintInstance {
  id: string;
  tenantId: string;
  blueprintId: string;
  blueprintVersion: string;
  config: Record<string, unknown>;
  status: BlueprintInstanceStatus;
  installedAt: string;
  updatedAt: string;
  installedBy: string;
}

export interface BlueprintVersion {
  id: string;
  blueprintId: string;
  version: string;
  manifest: BlueprintManifest;
  changelog: string;
  releasedAt: string;
  isLatest: boolean;
  releasedBy: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface BlueprintValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Repository Interfaces ────────────────────────────────────────────────────

export interface BlueprintManifestRepository {
  save(manifest: BlueprintManifest): Promise<BlueprintManifest>;
  findById(id: string): Promise<BlueprintManifest | null>;
  findAll(): Promise<BlueprintManifest[]>;
  findByCategory(category: BlueprintCategory): Promise<BlueprintManifest[]>;
  delete(id: string): Promise<void>;
}

export interface BlueprintInstanceRepository {
  save(instance: BlueprintInstance): Promise<BlueprintInstance>;
  findById(id: string): Promise<BlueprintInstance | null>;
  findByTenant(tenantId: string): Promise<BlueprintInstance[]>;
  findByTenantAndBlueprint(
    tenantId: string,
    blueprintId: string,
  ): Promise<BlueprintInstance | null>;
  delete(id: string): Promise<void>;
}

export interface BlueprintVersionRepository {
  save(version: BlueprintVersion): Promise<BlueprintVersion>;
  findByBlueprintAndVersion(blueprintId: string, version: string): Promise<BlueprintVersion | null>;
  findLatest(blueprintId: string): Promise<BlueprintVersion | null>;
  listByBlueprint(blueprintId: string): Promise<BlueprintVersion[]>;
  markAllNotLatest(blueprintId: string): Promise<void>;
}
