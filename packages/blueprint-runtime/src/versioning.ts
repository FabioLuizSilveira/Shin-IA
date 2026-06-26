import { randomUUID } from "crypto";
import type {
  BlueprintInstance,
  BlueprintInstanceRepository,
  BlueprintManifest,
  BlueprintVersion,
  BlueprintVersionRepository,
} from "./types.js";

export class BlueprintVersioningError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "BlueprintVersioningError";
  }
}

export class BlueprintVersioning {
  constructor(
    private readonly versionRepo: BlueprintVersionRepository,
    private readonly instanceRepo: BlueprintInstanceRepository,
  ) {}

  async createVersion(
    manifest: BlueprintManifest,
    changelog: string,
    actorId: string,
  ): Promise<BlueprintVersion> {
    await this.versionRepo.markAllNotLatest(manifest.id);

    const version: BlueprintVersion = {
      id: randomUUID(),
      blueprintId: manifest.id,
      version: manifest.version,
      manifest,
      changelog,
      releasedAt: new Date().toISOString(),
      isLatest: true,
      releasedBy: actorId,
    };

    return this.versionRepo.save(version);
  }

  async getVersionHistory(blueprintId: string): Promise<BlueprintVersion[]> {
    return this.versionRepo.listByBlueprint(blueprintId);
  }

  async getLatest(blueprintId: string): Promise<BlueprintVersion | null> {
    return this.versionRepo.findLatest(blueprintId);
  }

  async rollback(
    tenantId: string,
    blueprintId: string,
    targetVersion: string,
    actorId: string,
  ): Promise<BlueprintInstance> {
    const versionRecord = await this.versionRepo.findByBlueprintAndVersion(
      blueprintId,
      targetVersion,
    );
    if (!versionRecord) {
      throw new BlueprintVersioningError(
        `Version "${targetVersion}" of blueprint "${blueprintId}" not found`,
        "VERSION_NOT_FOUND",
      );
    }

    const instance = await this.instanceRepo.findByTenantAndBlueprint(tenantId, blueprintId);
    if (!instance) {
      throw new BlueprintVersioningError(
        `Blueprint "${blueprintId}" is not installed for tenant "${tenantId}"`,
        "NOT_INSTALLED",
      );
    }

    const rolledBack: BlueprintInstance = {
      ...instance,
      blueprintVersion: targetVersion,
      updatedAt: new Date().toISOString(),
      installedBy: actorId,
    };

    return this.instanceRepo.save(rolledBack);
  }
}
