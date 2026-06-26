import type { ModelProvider, ModelProviderName } from "./types.js";

export class ModelProviderRegistry {
  private providers = new Map<ModelProviderName, ModelProvider>();

  register(provider: ModelProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: ModelProviderName): ModelProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`model provider "${name}" not registered`);
    return provider;
  }

  has(name: ModelProviderName): boolean {
    return this.providers.has(name);
  }

  list(): ModelProviderName[] {
    return [...this.providers.keys()];
  }
}
