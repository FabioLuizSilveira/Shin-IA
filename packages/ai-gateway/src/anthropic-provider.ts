import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ToolDefinition,
} from "@shina/ai-platform";
import { generateText, AIProviderError, type AnthropicToolDefinition } from "./anthropic.js";

// Real reuse of @shina/ai-platform's ModelProvider contract (not a parallel
// abstraction) for the single-turn text-generation path of the AI gateway.
// Delegates to generateText() instead of duplicating it — adapts
// ModelRequest/ModelResponse <-> that function's shape, threading the
// resolved per-workspace credential through ModelRequest.credentials and
// (additive, apps/mkt never used this before) request.tools through to
// Anthropic's own tool-use format, surfacing any tool_use blocks back as
// ModelResponse.toolCalls.
//
// Vision (clone-ad's analyzeImage) is intentionally NOT routed through this
// adapter: ai-platform's ModelMessage.content is text-only, so a
// multimodal (image + text) request has no lossless representation here —
// callers needing vision use analyzeImage() directly (documented gap, not
// silently worked around).
function toAnthropicTool(t: ToolDefinition): AnthropicToolDefinition {
  return { name: t.name, description: t.description, input_schema: t.parameters };
}

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
      tools: request.tools?.map(toAnthropicTool),
    });

    return {
      id: crypto.randomUUID(),
      model: result.model,
      content: result.text,
      role: "assistant",
      toolCalls: result.toolUses.map((t) => ({ id: t.id, name: t.name, arguments: t.input })),
      usage: {
        promptTokens: result.tokensIn,
        completionTokens: result.tokensOut,
        totalTokens: result.tokensIn + result.tokensOut,
      },
      finishReason: result.stopReason === "tool_use" ? "tool_use" : "stop",
    };
  }
}
