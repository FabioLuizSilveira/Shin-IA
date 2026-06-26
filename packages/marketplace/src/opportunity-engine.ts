import type { Opportunity, Partner, MatchScore, OpportunityStatus } from "./types.js";
import { MarketplaceError } from "./partner-registry.js";

export function scorePartnerForOpportunity(partner: Partner, opportunity: Opportunity): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  const capabilityMatches = opportunity.requiredCapabilities.filter((c) =>
    partner.capabilities.includes(c),
  );
  const capabilityScore = (capabilityMatches.length / opportunity.requiredCapabilities.length) * 50;
  score += capabilityScore;
  if (capabilityMatches.length > 0) {
    reasons.push(
      `Matches ${capabilityMatches.length}/${opportunity.requiredCapabilities.length} required capabilities`,
    );
  }

  if (partner.regions.includes(opportunity.region)) {
    score += 30;
    reasons.push(`Operates in required region: ${opportunity.region}`);
  }

  const tierBonus: Record<string, number> = { platinum: 20, gold: 15, silver: 10, bronze: 5 };
  score += tierBonus[partner.tier] ?? 0;
  reasons.push(`Tier bonus: ${partner.tier}`);

  return { partnerId: partner.id, score, reasons };
}

export class OpportunityEngine {
  private readonly opportunities = new Map<string, Opportunity>();

  create(opportunity: Opportunity): void {
    if (this.opportunities.has(opportunity.id)) {
      throw new MarketplaceError(
        `Opportunity already exists: ${opportunity.id}`,
        "DUPLICATE_OPPORTUNITY",
      );
    }
    this.opportunities.set(opportunity.id, { ...opportunity, status: "open" });
  }

  get(id: string): Opportunity {
    const o = this.opportunities.get(id);
    if (!o) throw new MarketplaceError(`Opportunity not found: ${id}`, "OPPORTUNITY_NOT_FOUND");
    return { ...o };
  }

  match(id: string, partners: Partner[]): MatchScore[] {
    const opp = this.get(id);
    if (opp.status !== "open") {
      throw new MarketplaceError(`Opportunity is not open: ${id}`, "OPPORTUNITY_NOT_OPEN");
    }
    const activePartners = partners.filter((p) => p.status === "active");
    return activePartners
      .map((p) => scorePartnerForOpportunity(p, opp))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  accept(id: string, partnerId: string): void {
    const opp = this.opportunities.get(id);
    if (!opp) throw new MarketplaceError(`Opportunity not found: ${id}`, "OPPORTUNITY_NOT_FOUND");
    if (opp.status !== "open" && opp.status !== "matched") {
      throw new MarketplaceError(
        `Opportunity cannot be accepted: ${id}`,
        "INVALID_OPPORTUNITY_STATE",
      );
    }
    this.opportunities.set(id, { ...opp, status: "accepted", matchedPartnerId: partnerId });
  }

  decline(id: string): void {
    const opp = this.opportunities.get(id);
    if (!opp) throw new MarketplaceError(`Opportunity not found: ${id}`, "OPPORTUNITY_NOT_FOUND");
    this.opportunities.set(id, { ...opp, status: "declined" });
  }

  close(id: string): void {
    const opp = this.opportunities.get(id);
    if (!opp) throw new MarketplaceError(`Opportunity not found: ${id}`, "OPPORTUNITY_NOT_FOUND");
    this.opportunities.set(id, { ...opp, status: "closed" });
  }

  listByStatus(status: OpportunityStatus): Opportunity[] {
    return [...this.opportunities.values()].filter((o) => o.status === status);
  }

  listByTenant(tenantId: string): Opportunity[] {
    return [...this.opportunities.values()].filter((o) => o.tenantId === tenantId);
  }

  listExpired(): Opportunity[] {
    const now = new Date();
    return [...this.opportunities.values()].filter(
      (o) => o.expiresAt && new Date(o.expiresAt) < now && o.status === "open",
    );
  }

  count(): number {
    return this.opportunities.size;
  }
}
