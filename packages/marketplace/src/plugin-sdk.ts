import type { Plugin, PluginStatus } from "./types.js";
import { MarketplaceError } from "./partner-registry.js";

export class PluginSDK {
  private readonly plugins = new Map<string, Plugin>();

  publish(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new MarketplaceError(`Plugin already exists: ${plugin.id}`, "DUPLICATE_PLUGIN");
    }
    this.plugins.set(plugin.id, { ...plugin, status: "submitted" });
  }

  get(id: string): Plugin {
    const p = this.plugins.get(id);
    if (!p) throw new MarketplaceError(`Plugin not found: ${id}`, "PLUGIN_NOT_FOUND");
    return { ...p };
  }

  approve(id: string): void {
    const p = this.plugins.get(id);
    if (!p) throw new MarketplaceError(`Plugin not found: ${id}`, "PLUGIN_NOT_FOUND");
    if (p.status !== "submitted") {
      throw new MarketplaceError(`Plugin not in submitted state: ${id}`, "INVALID_PLUGIN_STATE");
    }
    this.plugins.set(id, { ...p, status: "approved", publishedAt: new Date().toISOString() });
  }

  reject(id: string): void {
    const p = this.plugins.get(id);
    if (!p) throw new MarketplaceError(`Plugin not found: ${id}`, "PLUGIN_NOT_FOUND");
    if (p.status !== "submitted") {
      throw new MarketplaceError(`Plugin not in submitted state: ${id}`, "INVALID_PLUGIN_STATE");
    }
    this.plugins.set(id, { ...p, status: "rejected" });
  }

  deprecate(id: string): void {
    const p = this.plugins.get(id);
    if (!p) throw new MarketplaceError(`Plugin not found: ${id}`, "PLUGIN_NOT_FOUND");
    if (p.status !== "approved") {
      throw new MarketplaceError(
        `Can only deprecate approved plugins: ${id}`,
        "INVALID_PLUGIN_STATE",
      );
    }
    this.plugins.set(id, { ...p, status: "deprecated", deprecatedAt: new Date().toISOString() });
  }

  listByStatus(status: PluginStatus): Plugin[] {
    return [...this.plugins.values()].filter((p) => p.status === status);
  }

  listByPartner(partnerId: string): Plugin[] {
    return [...this.plugins.values()].filter((p) => p.partnerId === partnerId);
  }

  listByCapability(capability: string): Plugin[] {
    return [...this.plugins.values()].filter((p) => p.capabilities.includes(capability));
  }

  count(): number {
    return this.plugins.size;
  }
}
