export * from "./types.js";
export { hashContent } from "./hash.js";
export { resolveRequiredContract, resolvePlanVersion } from "./contract-requirement.js";
export { createCommercialTermsSnapshot } from "./snapshot.js";
export { recordContractAcceptance, hasAcceptedCurrentContract } from "./acceptance.js";
export { createCommercialCheckout } from "./checkout-orchestration.js";
export { activateFromWebhook } from "./webhook-orchestration.js";
export { getEntitlements } from "./entitlements.js";
export { changePlan, type ChangePlanInput, type ChangePlanResult } from "./plan-change.js";
export {
  activateSubscriptionManually,
  type BillingMode,
  type ManualActivationInput,
} from "./manual-activation.js";

// WAVE 1 — Intelligent Onboarding foundation
export {
  createBusinessProfileVersion,
  confirmBusinessProfile,
  getConfirmedBusinessProfile,
  type BusinessProfile,
  type BusinessProfileInput,
  type BusinessProfileAnswer,
  type BusinessProfileSource,
  type BusinessProfileStatus,
} from "./business-profile.js";
export {
  createCommercialConfiguration,
  updateCommercialConfiguration,
  markCommercialConfigurationAccepted,
  type CommercialConfiguration,
  type CommercialConfigInput,
  type CommercialConfigSource,
  type CommercialConfigStatus,
  type CommercialQuotas,
} from "./commercial-configuration.js";
export {
  resolveCurrentRetentionPolicy,
  type RetentionPolicy,
  type RetentionRule,
  type RetentionAction,
} from "./retention-policy.js";
