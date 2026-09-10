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

// WAVE 2 — Intelligent Onboarding discovery & recommendation
export {
  listDiscoveryQuestions,
  nextDiscoveryQuestion,
  isDiscoveryComplete,
  questionApplies,
  type DiscoveryQuestion,
  type DiscoveryQuestionType,
  type DiscoveryOption,
  type DiscoveryAnswer,
} from "./discovery.js";
export {
  resolveBlueprint,
  resolveBlueprintWithRules,
  loadActiveBlueprintResolverRules,
  type BlueprintResolution,
  type ResolverProfileInput,
  type RecommendationReason,
} from "./blueprint-resolver.js";
export {
  resolvePlan,
  resolvePlanWithRules,
  loadActivePlanResolverRules,
  type PlanResolution,
} from "./plan-resolver.js";
export {
  buildOnboardingRecommendation,
  type OnboardingRecommendation,
  type RecommendedPlan,
} from "./recommendation.js";
