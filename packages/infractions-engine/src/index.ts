export * from "./types.js";
export { normalizePlate, normalizeRenavam } from "./normalize.js";
export { buildDedupKey } from "./dedup.js";
export { resolveAssetMatch } from "./matching.js";
export { suggestResponsibility } from "./responsibility.js";
export { resolveDeadline, deadlineStatusFor } from "./deadline.js";
export { ALLOWED_CASE_TRANSITIONS, canTransitionCase } from "./transitions.js";
export {
  ManualInfractionProvider,
  CsvInfractionProvider,
  NullOfficialProvider,
  NullOfficialProviderError,
} from "./providers.js";
