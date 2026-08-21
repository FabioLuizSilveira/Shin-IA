import { ModelProviderRegistry } from "@shina/ai-platform";
import { AnthropicModelProvider } from "./anthropic-provider";

// Process-wide singleton, same pattern @shina/ai-platform's own agent
// runtime expects — registration is provider identity (which SDK to call),
// not credentials (those are per-request, see ModelRequest.credentials).
let registry: ModelProviderRegistry | null = null;

export function getModelProviderRegistry(): ModelProviderRegistry {
  if (!registry) {
    registry = new ModelProviderRegistry();
    registry.register(new AnthropicModelProvider());
  }
  return registry;
}
