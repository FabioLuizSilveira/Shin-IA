import type {
  WorkflowDefinition,
  WorkflowVersion,
  WorkflowVersionRepository,
  WorkflowDefinitionRepository,
} from "./types.js";

export interface VersioningServiceDeps {
  definitionRepository: WorkflowDefinitionRepository;
  versionRepository: WorkflowVersionRepository;
}

export class WorkflowVersioningService {
  private definitions: WorkflowDefinitionRepository;
  private versions: WorkflowVersionRepository;

  constructor(deps: VersioningServiceDeps) {
    this.definitions = deps.definitionRepository;
    this.versions = deps.versionRepository;
  }

  async publishVersion(
    definitionId: string,
    changelog: string,
    publishedBy: string,
  ): Promise<WorkflowVersion> {
    const definition = await this.definitions.findById(definitionId);
    if (!definition) throw new Error(`WorkflowDefinition '${definitionId}' not found`);

    const nextVersion = definition.currentVersion + 1;
    const now = new Date().toISOString();

    const versionRecord: WorkflowVersion = {
      id: crypto.randomUUID(),
      definitionId,
      version: nextVersion,
      snapshot: { ...definition, currentVersion: nextVersion },
      changelog,
      publishedBy,
      publishedAt: now,
    };

    const saved = await this.versions.save(versionRecord);

    await this.definitions.update({
      ...definition,
      currentVersion: nextVersion,
      updatedAt: now,
    });

    return saved;
  }

  async getVersionHistory(definitionId: string): Promise<WorkflowVersion[]> {
    return this.versions.findByDefinitionId(definitionId);
  }

  async getVersion(definitionId: string, version: number): Promise<WorkflowVersion | null> {
    return this.versions.findByDefinitionAndVersion(definitionId, version);
  }

  async rollbackToVersion(
    definitionId: string,
    targetVersion: number,
    rollbackBy: string,
  ): Promise<WorkflowDefinition> {
    const version = await this.versions.findByDefinitionAndVersion(definitionId, targetVersion);
    if (!version) {
      throw new Error(`Version ${targetVersion} not found for definition '${definitionId}'`);
    }

    const current = await this.definitions.findById(definitionId);
    if (!current) throw new Error(`WorkflowDefinition '${definitionId}' not found`);

    const now = new Date().toISOString();
    const rollbackVersion = current.currentVersion + 1;

    const rolledBack: WorkflowDefinition = {
      ...version.snapshot,
      id: definitionId,
      currentVersion: rollbackVersion,
      updatedAt: now,
    };

    await this.versions.save({
      id: crypto.randomUUID(),
      definitionId,
      version: rollbackVersion,
      snapshot: rolledBack,
      changelog: `Rollback to v${targetVersion} by ${rollbackBy}`,
      publishedBy: rollbackBy,
      publishedAt: now,
    });

    return this.definitions.update(rolledBack);
  }
}
