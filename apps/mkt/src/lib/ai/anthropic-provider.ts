import type { ModelProvider, ModelRequest, ModelResponse } from "@shina/ai-platform";
import { generateText, AIProviderError } from "./anthropic";

// Real reuse of @shina/ai-platform's ModelProvider contract (not a parallel
// abstraction) for the text-generation path of the AI gateway. Delegates to
// the existing generateText() fetch implementation instead of duplicating
// it — this class only adapts ModelRequest/ModelResponse <-> that function's
// shape, and threads the resolved per-workspace credential through
// ModelRequest.credentials (see the extension added to
// packages/ai-platform/src/types.ts, additive/optional so the original
// single-credential-per-process agent-runtime callers are unaffected).
//
// Vision (clone-ad's analyzeImage) is intentionally NOT routed through this
// adapter: ai-platform's ModelMessage.content is text-only today, so a
// multimodal (image + text) request has no lossless representation in this
// interface. Rather than force-fit it, /api/clone keeps calling
// analyzeImage() directly through the gateway's own resolveCredential() —
// documented as a real gap in ai-platform, not silently worked around.
export class AnthropicModelProvider implements ModelProvider {
  readonly name = "anthropic" as const;

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const system = request.messages.find((m) => m.role === "system")?.content ?? "";
    const userTurns = request.messages.filter((m) => m.role !== "system");
    const prompt = userTurns.map((m) => m.content).join("\n\n");

    if (!request.credentials?.apiKey) {
      throw new AIProviderError("No credential resolved for this request", 500);
    }

    const result = await generateText({
      system,
      prompt,
      maxTokens: request.maxTokens,
      model: request.model,
      apiKey: request.credentials.apiKey,
    });

    return {
      id: crypto.randomUUID(),
      model: result.model,
      content: result.text,
      role: "assistant",
      usage: {
        promptTokens: result.tokensIn,
        completionTokens: result.tokensOut,
        totalTokens: result.tokensIn + result.tokensOut,
      },
      finishReason: "stop",
    };
  }
}
