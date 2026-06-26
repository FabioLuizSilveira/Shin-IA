import type {
  BlueprintInstance,
  BlueprintInstanceRepository,
  BlueprintManifest,
  BlueprintManifestRepository,
  BlueprintValidationResult,
  BlueprintVersion,
  BlueprintVersionRepository,
} from "./types.js";
import { BlueprintRegistry } from "./registry.js";
import { BlueprintInstaller } from "./installer.js";
import { BlueprintConfigurator } from "./configurator.js";
import { BlueprintVersioning } from "./versioning.js";
import { BUILT_IN_BLUEPRINTS } from "./built-ins.js";

export interface BlueprintRuntimeDeps {
  manifestRepo: BlueprintManifestRepository;
  instanceRepo: BlueprintInstanceRepository;
  versionRepo: BlueprintVersionRepository;
  seedBuiltIns?: boolean;
}

export class BlueprintRuntime {
  readonly registry: BlueprintRegistry;
  private readonly installer: BlueprintInstaller;
  private readonly configurator: BlueprintConfigurator;
  private readonly versioning: BlueprintVersioning;

  constructor(deps: BlueprintRuntimeDeps) {
    const seed = deps.seedBuiltIns !== false ? BUILT_IN_BLUEPRINTS : [];
    this.registry = new BlueprintRegistry(seed);
    this.installer = new BlueprintInstaller(this.registry, deps.instanceRepo);
    this.configurator = new BlueprintConfigurator(deps.instanceRepo);
    this.versioning = new BlueprintVersioning(deps.versionRepo, deps.instanceRepo);
  }

  // ─── Registry operations ─────────────────────────────────────────────────

  registerBlueprint(manifest: BlueprintManifest): void {
    this.registry.register(manifest);
  }

  getBlueprint(id: string): BlueprintManifest {
    return this.registry.get(id);
  }

  listBlueprints(): BlueprintManifest[] {
    return this.registry.list();
  }

  // ─── Installation ─────────────────────────────────────────────────────────

  validate(blueprintId: string, config: Record<string, unknown>): BlueprintValidationResult {
    return this.installer.validate(blueprintId, config);
  }

  async install(
    tenantId: string,
    blueprintId: string,
    config: Record<string, unknown>,
    actorId: string,
  ): Promise<BlueprintInstance> {
    return this.installer.install(tenantId, blueprintId, config, actorId);
  }

  async uninstall(tenantId: string, blueprintId: string): Promise<void> {
    return this.installer.uninstall(tenantId, blueprintId);
  }

  async upgrade(
    tenantId: string,
    blueprintId: string,
    newVersion: string,
    actorId: string,
  ): Promise<BlueprintInstance> {
    return this.installer.upgrade(tenantId, blueprintId, newVersion, actorId);
  }

  // ─── Configuration ────────────────────────────────────────────────────────

  async getConfig(tenantId: string, blueprintId: string): Promise<Record<string, unknown>> {
    return this.configurator.getConfig(tenantId, blueprintId);
  }

  async updateConfig(
    tenantId: string,
    blueprintId: string,
    updates: Record<string, unknown>,
    actorId: string,
  ): Promise<BlueprintInstance> {
    return this.configurator.updateConfig(tenantId, blueprintId, updates, actorId);
  }

  async resetConfig(
    tenantId: string,
    blueprintId: string,
    actorId: string,
  ): Promise<BlueprintInstance> {
    return this.configurator.resetConfig(tenantId, blueprintId, actorId);
  }

  // ─── Versioning ───────────────────────────────────────────────────────────

  async publishVersion(
    manifest: BlueprintManifest,
    changelog: string,
    actorId: string,
  ): Promise<BlueprintVersion> {
    return this.versioning.createVersion(manifest, changelog, actorId);
  }

  async getVersionHistory(blueprintId: string): Promise<BlueprintVersion[]> {
    return this.versioning.getVersionHistory(blueprintId);
  }

  async rollback(
    tenantId: string,
    blueprintId: string,
    targetVersion: string,
    actorId: string,
  ): Promise<BlueprintInstance> {
    return this.versioning.rollback(tenantId, blueprintId, targetVersion, actorId);
  }
}
