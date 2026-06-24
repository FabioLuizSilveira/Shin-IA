import type { BlueprintInstance, BlueprintInstanceRepository } from "./types.js";

export class BlueprintConfiguratorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "BlueprintConfiguratorError";
  }
}

export class BlueprintConfigurator {
  constructor(private readonly instanceRepo: BlueprintInstanceRepository) {}

  async getConfig(tenantId: string, blueprintId: string): Promise<Record<string, unknown>> {
    const instance = await this.instanceRepo.findByTenantAndBlueprint(tenantId, blueprintId);
    if (!instance) {
      throw new BlueprintConfiguratorError(
        `Blueprint "${blueprintId}" is not installed for tenant "${tenantId}"`,
        "NOT_INSTALLED",
      );
    }
    return instance.config;
  }

  async updateConfig(
    tenantId: string,
    blueprintId: string,
    updates: Record<string, unknown>,
    actorId: string,
  ): Promise<BlueprintInstance> {
    const instance = await this.instanceRepo.findByTenantAndBlueprint(tenantId, blueprintId);
    if (!instance) {
      throw new BlueprintConfiguratorError(
        `Blueprint "${blueprintId}" is not installed for tenant "${tenantId}"`,
        "NOT_INSTALLED",
      );
    }

    const updated: BlueprintInstance = {
      ...instance,
      config: { ...instance.config, ...updates },
      updatedAt: new Date().toISOString(),
      installedBy: actorId,
    };

    return this.instanceRepo.save(updated);
  }

  async resetConfig(
    tenantId: string,
    blueprintId: string,
    actorId: string,
  ): Promise<BlueprintInstance> {
    const instance = await this.instanceRepo.findByTenantAndBlueprint(tenantId, blueprintId);
    if (!instance) {
      throw new BlueprintConfiguratorError(
        `Blueprint "${blueprintId}" is not installed for tenant "${tenantId}"`,
        "NOT_INSTALLED",
      );
    }

    const reset: BlueprintInstance = {
      ...instance,
      config: {},
      updatedAt: new Date().toISOString(),
      installedBy: actorId,
    };

    return this.instanceRepo.save(reset);
  }
}
