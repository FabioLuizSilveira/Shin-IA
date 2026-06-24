import type { AuthorizationContext, SessionTrustLevel } from "../types.js";

// Operations that require MFA regardless of role
export const SENSITIVE_OPERATIONS = new Map<string, SessionTrustLevel>([
  // Billing & Finance
  ["billing.payment_method:change", "HIGH"],
  ["billing.plan:change", "HIGH"],
  ["billing.credits:create", "VERY_HIGH"],
  ["finance.commission.rate:approve", "VERY_HIGH"],
  ["finance.reports:export", "HIGH"],

  // Ownership
  ["tenant.ownership:transfer", "VERY_HIGH"],
  ["platform.ownership:transfer", "VERY_HIGH"],

  // Platform IAM
  ["platform.tenants:delete", "VERY_HIGH"],
  ["platform.tenants:suspend", "HIGH"],
  ["platform.operators:assign_role", "HIGH"],

  // Impersonation
  ["platform.impersonation:start", "HIGH"],

  // Audit
  ["platform.audit:delete", "VERY_HIGH"],
  ["platform.config:manage", "HIGH"],
]);

// Trust level hierarchy for comparisons
const TRUST_LEVEL_ORDER: Record<SessionTrustLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  VERY_HIGH: 3,
};

export interface MfaRequirement {
  required: boolean;
  minimumTrustLevel: SessionTrustLevel;
  reason: string;
}

export interface StepUpResult {
  allowed: boolean;
  reason: string;
  requiresStepUp: boolean;
  currentTrustLevel: SessionTrustLevel;
  requiredTrustLevel: SessionTrustLevel;
}

export class MfaHardeningService {
  // Determine the MFA requirement for an operation
  getRequirement(operation: string): MfaRequirement {
    const requiredLevel = SENSITIVE_OPERATIONS.get(operation);

    if (!requiredLevel) {
      return {
        required: false,
        minimumTrustLevel: "LOW",
        reason: "Operation does not require MFA",
      };
    }

    return {
      required: true,
      minimumTrustLevel: requiredLevel,
      reason: `Operation '${operation}' requires trust level ${requiredLevel}`,
    };
  }

  // Check if the user's current session satisfies the MFA requirement
  checkStepUp(ctx: AuthorizationContext, operation: string): StepUpResult {
    const requirement = this.getRequirement(operation);

    if (!requirement.required) {
      return {
        allowed: true,
        reason: "No MFA required for this operation",
        requiresStepUp: false,
        currentTrustLevel: ctx.sessionTrustLevel,
        requiredTrustLevel: "LOW",
      };
    }

    const currentOrder = TRUST_LEVEL_ORDER[ctx.sessionTrustLevel];
    const requiredOrder = TRUST_LEVEL_ORDER[requirement.minimumTrustLevel];
    const sufficient = currentOrder >= requiredOrder;

    if (!sufficient) {
      return {
        allowed: false,
        reason: `Step-up authentication required: need ${requirement.minimumTrustLevel}, have ${ctx.sessionTrustLevel}`,
        requiresStepUp: true,
        currentTrustLevel: ctx.sessionTrustLevel,
        requiredTrustLevel: requirement.minimumTrustLevel,
      };
    }

    // Even if trust level is sufficient, MFA must be verified in session
    if (!ctx.mfaVerified && requirement.minimumTrustLevel !== "LOW") {
      return {
        allowed: false,
        reason: "MFA verification required in current session",
        requiresStepUp: true,
        currentTrustLevel: ctx.sessionTrustLevel,
        requiredTrustLevel: requirement.minimumTrustLevel,
      };
    }

    return {
      allowed: true,
      reason: "Trust level satisfied",
      requiresStepUp: false,
      currentTrustLevel: ctx.sessionTrustLevel,
      requiredTrustLevel: requirement.minimumTrustLevel,
    };
  }

  // Compare two trust levels
  isSufficientTrust(current: SessionTrustLevel, required: SessionTrustLevel): boolean {
    return TRUST_LEVEL_ORDER[current] >= TRUST_LEVEL_ORDER[required];
  }

  // Determine trust level from session state
  calculateTrustLevel(opts: {
    mfaVerified: boolean;
    isImpersonating: boolean;
    recentMfaVerification: boolean;
    deviceTrusted: boolean;
  }): SessionTrustLevel {
    if (opts.isImpersonating) return "LOW"; // Impersonation sessions always LOW
    if (!opts.mfaVerified) return "LOW";
    if (!opts.recentMfaVerification) return "MEDIUM";
    if (opts.deviceTrusted && opts.recentMfaVerification) return "VERY_HIGH";
    return "HIGH";
  }

  // List all operations requiring a specific trust level or higher
  getOperationsForLevel(minimumLevel: SessionTrustLevel): string[] {
    const minOrder = TRUST_LEVEL_ORDER[minimumLevel];
    return Array.from(SENSITIVE_OPERATIONS.entries())
      .filter(([, level]) => TRUST_LEVEL_ORDER[level] >= minOrder)
      .map(([op]) => op);
  }
}
