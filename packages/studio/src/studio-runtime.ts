import { randomUUID } from "crypto";
import type {
  AnyStudioConfig,
  StudioDraft,
  StudioDraftRepository,
  StudioType,
  StudioVersion,
  StudioVersionRepository,
} from "./types.js";
import { validateStudioConfig, type ValidationResult } from "./validators.js";

export class StudioError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "StudioError";
  }
}

export class StudioRuntime {
  constructor(
    private readonly draftRepo: StudioDraftRepository,
    private readonly versionRepo: StudioVersionRepository,
  ) {}

  validate(studioType: StudioType, config: AnyStudioConfig): ValidationResult {
    return validateStudioConfig(studioType, config);
  }

  async saveDraft(
    studioType: StudioType,
    tenantId: string,
    config: AnyStudioConfig,
    actorId: string,
  ): Promise<StudioDraft<AnyStudioConfig>> {
    const result = this.validate(studioType, config);
    if (!result.valid) {
      throw new StudioError(
        `Invalid ${studioType} config: ${result.errors.join("; ")}`,
        "VALIDATION_FAILED",
      );
    }

    const draft: StudioDraft<AnyStudioConfig> = {
      id: randomUUID(),
      tenantId,
      studioType,
      config,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };

    return this.draftRepo.save(draft);
  }

  async publish(
    studioType: StudioType,
    tenantId: string,
    actorId: string,
    changelog?: string,
  ): Promise<StudioVersion<AnyStudioConfig>> {
    const draft = await this.draftRepo.findByStudio(studioType, tenantId);
    if (!draft) {
      throw new StudioError(
        `No draft found for studio "${studioType}" in tenant "${tenantId}"`,
        "DRAFT_NOT_FOUND",
      );
    }

    const latest = await this.versionRepo.findLatest(studioType, tenantId);
    const nextVersion = latest !== null ? latest.version + 1 : 1;

    const version: StudioVersion<AnyStudioConfig> = {
      id: randomUUID(),
      tenantId,
      studioType,
      version: nextVersion,
      config: draft.config,
      publishedAt: new Date().toISOString(),
      publishedBy: actorId,
      changelog,
    };

    return this.versionRepo.save(version);
  }

  async getDraft(
    studioType: StudioType,
    tenantId: string,
  ): Promise<StudioDraft<AnyStudioConfig> | null> {
    return this.draftRepo.findByStudio(studioType, tenantId);
  }

  async getPublished(
    studioType: StudioType,
    tenantId: string,
  ): Promise<StudioVersion<AnyStudioConfig> | null> {
    return this.versionRepo.findLatest(studioType, tenantId);
  }

  async getVersionHistory(
    studioType: StudioType,
    tenantId: string,
  ): Promise<StudioVersion<AnyStudioConfig>[]> {
    return this.versionRepo.listByStudio(studioType, tenantId);
  }

  async revertToVersion(
    studioType: StudioType,
    tenantId: string,
    versionId: string,
    actorId: string,
  ): Promise<StudioVersion<AnyStudioConfig>> {
    const target = await this.versionRepo.findById(versionId);
    if (!target) {
      throw new StudioError(`Version "${versionId}" not found`, "VERSION_NOT_FOUND");
    }

    const latest = await this.versionRepo.findLatest(studioType, tenantId);
    const nextVersion = latest !== null ? latest.version + 1 : 1;

    const reverted: StudioVersion<AnyStudioConfig> = {
      id: randomUUID(),
      tenantId,
      studioType,
      version: nextVersion,
      config: target.config,
      publishedAt: new Date().toISOString(),
      publishedBy: actorId,
      changelog: `Reverted to version ${target.version}`,
    };

    return this.versionRepo.save(reverted);
  }
}
