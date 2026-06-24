import type { Partner, PartnerTier, PartnerStatus } from "./types.js";

export class MarketplaceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "MarketplaceError";
  }
}

export class PartnerRegistry {
  private readonly partners = new Map<string, Partner>();

  register(partner: Partner): void {
    if (this.partners.has(partner.id)) {
      throw new MarketplaceError(`Partner already registered: ${partner.id}`, "DUPLICATE_PARTNER");
    }
    this.partners.set(partner.id, { ...partner });
  }

  get(id: string): Partner {
    const p = this.partners.get(id);
    if (!p) throw new MarketplaceError(`Partner not found: ${id}`, "PARTNER_NOT_FOUND");
    return { ...p };
  }

  updateStatus(id: string, status: PartnerStatus): void {
    const p = this.partners.get(id);
    if (!p) throw new MarketplaceError(`Partner not found: ${id}`, "PARTNER_NOT_FOUND");
    this.partners.set(id, { ...p, status });
  }

  updateTier(id: string, tier: PartnerTier): void {
    const p = this.partners.get(id);
    if (!p) throw new MarketplaceError(`Partner not found: ${id}`, "PARTNER_NOT_FOUND");
    this.partners.set(id, { ...p, tier });
  }

  listByTier(tier: PartnerTier): Partner[] {
    return [...this.partners.values()].filter((p) => p.tier === tier);
  }

  listActive(): Partner[] {
    return [...this.partners.values()].filter((p) => p.status === "active");
  }

  listByRegion(region: string): Partner[] {
    return [...this.partners.values()].filter((p) => p.regions.includes(region));
  }

  listByCapability(capability: string): Partner[] {
    return [...this.partners.values()].filter((p) => p.capabilities.includes(capability));
  }

  computeAverageRating(): number {
    const all = [...this.partners.values()];
    if (all.length === 0) return 0;
    return all.reduce((sum, p) => sum + p.rating, 0) / all.length;
  }

  count(): number {
    return this.partners.size;
  }
}
