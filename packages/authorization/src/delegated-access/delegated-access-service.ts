import type { DelegatedAccessRepository } from "@shina/iam-repository";
import type { DelegatedAccessRequestRow } from "@shina/iam-domain";
import type { AuthorizationContext } from "../types.js";

export interface DelegatedAccessServiceDeps {
  delegatedAccessRepository: DelegatedAccessRepository;
}

export interface GrantDelegationInput {
  tenantId: string;
  grantorId: string;
  granteeId: string;
  permissions: string[];
  branchIds: string[];
  reason?: string;
  expiresAt: Date;
}

export interface RevokeDelegationInput {
  delegationId: string;
  revokedBy: string;
  reason?: string;
}

export interface DelegatedPermissionCheckInput {
  tenantId: string;
  granteeId: string;
  permission: string;
  branchId?: string;
}

export class DelegatedAccessService {
  private repo: DelegatedAccessRepository;

  constructor(deps: DelegatedAccessServiceDeps) {
    this.repo = deps.delegatedAccessRepository;
  }

  async grantDelegation(input: GrantDelegationInput): Promise<DelegatedAccessRequestRow> {
    const now = new Date();

    const row: DelegatedAccessRequestRow = {
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      grantor_id: input.grantorId,
      grantee_id: input.granteeId,
      permissions: input.permissions,
      branch_ids: input.branchIds,
      reason: input.reason ?? null,
      status: "active",
      granted_at: now.toISOString(),
      expires_at: input.expiresAt.toISOString(),
      revoked_at: null,
      revoked_by: null,
      version: 1,
      metadata: {},
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      deleted_at: null,
    };

    return this.repo
      .create(new (await import("@shina/iam-domain").then((m) => m.DelegatedAccessRequest))(row))
      .then((entity) => entity.toRow());
  }

  async revokeDelegation(input: RevokeDelegationInput): Promise<void> {
    const delegation = await this.repo.findById(input.delegationId);
    if (!delegation) throw new Error(`Delegation ${input.delegationId} not found`);
    if (!delegation.isActive()) throw new Error(`Delegation ${input.delegationId} is not active`);

    const now = new Date().toISOString();
    await this.repo.update(
      new (await import("@shina/iam-domain").then((m) => m.DelegatedAccessRequest))({
        ...delegation.toRow(),
        status: "revoked",
        revoked_at: now,
        revoked_by: input.revokedBy,
        updated_at: now,
        version: delegation.version + 1,
      }),
    );
  }

  async expireOverdueDelegations(): Promise<number> {
    const expired = await this.repo.findExpiredAndActive();
    const now = new Date().toISOString();

    for (const delegation of expired) {
      const { DelegatedAccessRequest } = await import("@shina/iam-domain");
      await this.repo.update(
        new DelegatedAccessRequest({
          ...delegation.toRow(),
          status: "expired",
          updated_at: now,
          version: delegation.version + 1,
        }),
      );
    }

    return expired.length;
  }

  async getActiveGrantsForGrantee(tenantId: string, granteeId: string) {
    return this.repo.findActiveByGrantee(tenantId, granteeId);
  }

  async hasDelegatedPermission(input: DelegatedPermissionCheckInput): Promise<boolean> {
    const grants = await this.repo.findActiveByGrantee(input.tenantId, input.granteeId);

    return grants.some((grant) => {
      const hasPermission = grant.permissions.includes(input.permission);
      const inBranch =
        !input.branchId || grant.branchIds.length === 0 || grant.branchIds.includes(input.branchId);
      return hasPermission && inBranch;
    });
  }

  async auditUserDelegations(ctx: AuthorizationContext) {
    if (!ctx.tenantId) return { granted: [], received: [] };

    const [granted, received] = await Promise.all([
      this.repo.findByGrantor(ctx.tenantId, ctx.userId),
      this.repo.findByGrantee(ctx.tenantId, ctx.userId),
    ]);

    return { granted, received };
  }
}
