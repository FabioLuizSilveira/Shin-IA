import { describe, it, expect } from "vitest";
import { ScopeEvaluator } from "../abac/scope-evaluator.js";
import type { AuthorizationContext } from "../types.js";

describe("ScopeEvaluator", () => {
  const evaluator = new ScopeEvaluator();

  const ctx: AuthorizationContext = {
    userId: "user-123",
    tenantId: "tenant-456",
    platformRole: null,
    tenantRole: "tenant_owner",
    branchIds: ["branch-1", "branch-2"],
    capabilities: ["tracking.basic", "assets.read"],
    sessionTrustLevel: "HIGH",
    mfaVerified: true,
    isImpersonating: false,
  };

  describe("evaluateTenantScope", () => {
    it("should allow when no tenantId restriction", () => {
      expect(evaluator.evaluateTenantScope(ctx, {})).toBe(true);
    });

    it("should allow when tenantId matches", () => {
      expect(evaluator.evaluateTenantScope(ctx, { tenantId: "tenant-456" })).toBe(true);
    });

    it("should deny when tenantId mismatches", () => {
      expect(evaluator.evaluateTenantScope(ctx, { tenantId: "other-tenant" })).toBe(false);
    });
  });

  describe("evaluateBranchScope", () => {
    it("root mode allows any branch", () => {
      expect(evaluator.evaluateBranchScope(ctx, { branchId: "any-branch" }, { mode: "root" })).toBe(
        true,
      );
    });

    it("branch mode requires exact match", () => {
      expect(evaluator.evaluateBranchScope(ctx, { branchId: "branch-1" }, { mode: "branch" })).toBe(
        true,
      );
      expect(
        evaluator.evaluateBranchScope(ctx, { branchId: "branch-99" }, { mode: "branch" }),
      ).toBe(false);
    });

    it("branch_and_children mode allows branch and prefix-matched children", () => {
      const childCtx = { ...ctx, branchIds: ["branch-1"] };
      expect(
        evaluator.evaluateBranchScope(
          childCtx,
          { branchId: "branch-1-sub" },
          { mode: "branch_and_children" },
        ),
      ).toBe(true);
    });

    it("custom mode uses explicit list", () => {
      const result = evaluator.evaluateBranchScope(
        ctx,
        { branchId: "branch-X" },
        { mode: "custom", branchIds: ["branch-X", "branch-Y"] },
      );
      expect(result).toBe(true);
    });

    it("custom mode denies when not in list", () => {
      const result = evaluator.evaluateBranchScope(
        ctx,
        { branchId: "branch-Z" },
        { mode: "custom", branchIds: ["branch-X"] },
      );
      expect(result).toBe(false);
    });

    it("returns true when resource has no branch restriction", () => {
      expect(evaluator.evaluateBranchScope(ctx, {}, { mode: "branch" })).toBe(true);
    });
  });

  describe("evaluateCapabilityScope", () => {
    it("should allow when user has capability", () => {
      expect(evaluator.evaluateCapabilityScope(ctx, "tracking.basic")).toBe(true);
    });

    it("should deny when user lacks capability", () => {
      expect(evaluator.evaluateCapabilityScope(ctx, "tracking.advanced")).toBe(false);
    });
  });

  describe("evaluateAssetScope", () => {
    it("should allow when user has assets.read capability", () => {
      expect(evaluator.evaluateAssetScope(ctx, { assetId: "asset-1" })).toBe(true);
    });

    it("should deny when user lacks assets.read capability", () => {
      const noAssetCtx = { ...ctx, capabilities: ["tracking.basic"] };
      expect(evaluator.evaluateAssetScope(noAssetCtx, { assetId: "asset-1" })).toBe(false);
    });

    it("should allow when no assetId restriction", () => {
      expect(evaluator.evaluateAssetScope(ctx, {})).toBe(true);
    });
  });

  describe("evaluateBlueprintScope", () => {
    it("should allow tenant users to access blueprints", () => {
      expect(evaluator.evaluateBlueprintScope(ctx, { blueprintId: "bp-1" })).toBe(true);
    });

    it("should deny platform-only users (no tenantId) accessing blueprints", () => {
      const platformCtx = { ...ctx, tenantId: null };
      expect(evaluator.evaluateBlueprintScope(platformCtx, { blueprintId: "bp-1" })).toBe(false);
    });
  });
});
