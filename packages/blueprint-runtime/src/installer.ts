import { randomUUID } from "crypto";
import type {
  BlueprintInstance,
  BlueprintInstanceRepository,
  BlueprintValidationResult,
} from "./types.js";
import { BlueprintRegistry } from "./registry.js";

export class BlueprintInstallerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "BlueprintInstallerError";
  }
}

export class BlueprintInstaller {
  constructor(
    private readonly registry: BlueprintRegistry,
    private readonly instanceRepo: BlueprintInstanceRepository,
  ) {}

  validate(blueprintId: string, config: Record<string, unknown>): BlueprintValidationResult {
    const errors: string[] = [];

    if (!this.registry.has(blueprintId)) {
      errors.push(`Blueprint "${blueprintId}" is not registered`);
      return { valid: false, errors };
    }

    const manifest = this.registry.get(blueprintId);

    for (const field of manifest.customFields) {
      if (field.required && config[field.key] === undefined) {
        errors.push(`Required field "${field.key}" is missing`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async install(
    tenantId: string,
    blueprintId: string,
    config: Record<string, unknown>,
    actorId: string,
  ): Promise<BlueprintInstance> {
    const validation = this.validate(blueprintId, config);
    if (!validation.valid) {
      throw new BlueprintInstallerError(
        `Cannot install blueprint "${blueprintId}": ${validation.errors.join("; ")}`,
        "VALIDATION_FAILED",
      );
    }

    const existing = await this.instanceRepo.findByTenantAndBlueprint(tenantId, blueprintId);
    if (existing) {
      throw new BlueprintInstallerError(
        `Blueprint "${blueprintId}" is already installed for tenant "${tenantId}"`,
        "ALREADY_INSTALLED",
      );
    }

    const manifest = this.registry.get(blueprintId);
    const now = new Date().toISOString();

    const instance: BlueprintInstance = {
      id: randomUUID(),
      tenantId,
      blueprintId,
      blueprintVersion: manifest.version,
      config,
      status: "active",
      installedAt: now,
      updatedAt: now,
      installedBy: actorId,
    };

    return this.instanceRepo.save(instance);
  }

  async uninstall(tenantId: string, blueprintId: string): Promise<void> {
    const existing = await this.instanceRepo.findByTenantAndBlueprint(tenantId, blueprintId);
    if (!existing) {
      throw new BlueprintInstallerError(
        `Blueprint "${blueprintId}" is not installed for tenant "${tenantId}"`,
        "NOT_INSTALLED",
      );
    }
    await this.instanceRepo.delete(existing.id);
  }

  async upgrade(
    tenantId: string,
    blueprintId: string,
    newVersion: string,
    actorId: string,
  ): Promise<BlueprintInstance> {
    const existing = await this.instanceRepo.findByTenantAndBlueprint(tenantId, blueprintId);
    if (!existing) {
      throw new BlueprintInstallerError(
        `Blueprint "${blueprintId}" is not installed for tenant "${tenantId}"`,
        "NOT_INSTALLED",
      );
    }

    if (!this.registry.has(blueprintId)) {
      throw new BlueprintInstallerError(
        `Blueprint "${blueprintId}" is not registered`,
        "BLUEPRINT_NOT_FOUND",
      );
    }

    const upgraded: BlueprintInstance = {
      ...existing,
      blueprintVersion: newVersion,
      updatedAt: new Date().toISOString(),
      installedBy: actorId,
    };

    return this.instanceRepo.save(upgraded);
  }
}
