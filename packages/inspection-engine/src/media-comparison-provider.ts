import type { AiDamageSuggestion } from "./types.js";

export interface MediaComparisonRequest {
  beforeImageUrl: string;
  afterImageUrl: string;
  itemKey: string;
  itemLabel: string;
}

// Lives here, not in @shina/ai-platform — that package's ModelProvider is
// text-only today (a gap already documented in apps/mkt's
// AnthropicModelProvider for the symmetric case, analyzeImage() in the Ad
// Cloner). Rather than force-fit a multimodal request through a text-only
// interface, this mirrors packages/tenant-contract-engine's
// ContractSignatureProvider house style instead: define the interface in
// the domain package that needs it, implement only what's configured,
// document the rest as a pending external dependency (item 29 of the
// spec: never present a simulated result as a real feature).
//
// IMPORTANT (item 10 of the spec): a provider only ever SUGGESTS —
// possibleDamage/confidence/description are input to a human review step
// (InspectionFinding starts at status "detected" regardless of who/what
// raised it), never an automatic confirmation.
export interface InspectionMediaComparisonProvider {
  readonly name: string;
  compare(request: MediaComparisonRequest): Promise<AiDamageSuggestion | null>;
}

// No real vision provider is configured yet — no credentials, no product
// decision on which one (Anthropic/OpenAI/Gemini) to use. Returning null
// (not throwing) so callers can treat "no AI configured" as a normal,
// expected state rather than an error path — the comparison itself is
// still fully usable without it (human-entered responses are always
// compared regardless of AI availability, see comparison.ts).
export class NullMediaComparisonProvider implements InspectionMediaComparisonProvider {
  readonly name = "none" as const;

  async compare(_request: MediaComparisonRequest): Promise<AiDamageSuggestion | null> {
    return null;
  }
}
