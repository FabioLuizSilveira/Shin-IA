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
  type OperationConfigLineItem,
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
  collectSelectedVerticals,
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
export {
  mapVerticalToOperationType,
  resolveOperationProfilesForProfile,
  summarizeOperationProfiles,
  type ResolvedOperationProfile,
} from "./operation-type-mapping.js";

// WAVE 3 — Intelligent Onboarding pricing + contract composition
export {
  computePricing,
  computePricingWithRules,
  loadActivePricingRules,
  type PricingInput,
  type PricingResult,
  type PricingLineItem,
} from "./pricing.js";
export {
  composeOnboardingContract,
  freezeOnboardingContract,
  verifyFrozenContractHash,
  validateContractReadiness,
  detectPlaceholders,
  renderAnnex,
  resolveContractExecutionMode,
  type ComposeInput,
  type ComposedContract,
  type ContractReadiness,
  type ContractExecutionMode,
  type PlaceholderHit,
  type FreezeResult,
} from "./contract-composition.js";

// WAVE 4 — Intelligent Onboarding provisioning gate + run log
export {
  checkProvisioningReadiness,
  resolveProvisioningPlan,
  createProvisioningRun,
  finishProvisioningRun,
  type ProvisioningReadiness,
  type ProvisioningPlan,
  type ProvisioningStep,
} from "./provisioning.js";

// WAVE 5 — Intelligent Onboarding lifecycle (operate / evolve / offboard)
export {
  computeConfigurationDelta,
  resolveOffboardingPlan,
  type ConfigurationDelta,
  type ConfigurationSnapshotForDelta,
  type OffboardingPlan,
} from "./lifecycle.js";

// WAVE 1 — Multi-Operation Business Architecture v2 (domain layer)
export {
  createOperationProfile,
  listOperationProfiles,
  getOperationProfile,
  setPrimaryOperationProfile,
  setOperationProfileStatus,
  type BusinessOperationType,
  type OperationProfile,
  type OperationProfileInput,
  type OperationProfileRole,
  type OperationProfileStatus,
  type OperationProfileCharacteristics,
  type PassengerTransportCharacteristics,
  type TransportServiceModel,
  type TransportPurpose,
  type TowingCharacteristics,
  type TowingServiceModel,
  type DispatchServiceModel,
  type WaterTankCharacteristics,
  type BulkMaterialTransportCharacteristics,
  type BulkMaterialType,
  type ConcreteMixerCharacteristics,
  type GenericCharacteristics,
} from "./operation-profile.js";
